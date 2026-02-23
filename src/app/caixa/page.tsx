'use client';

import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, Button, CardHeader, CardTitle } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';
import { Plus, Minus, ArrowRightCircle, Wallet, History, AlertCircle, TrendingDown, TrendingUp } from 'lucide-react';

interface CashRegister {
    id: string;
    opened_by: string;
    opened_at: string;
    closed_at: string | null;
    initial_balance: number;
    final_balance: number | null;
    status: 'Aberto' | 'Fechado';
    notes: string | null;
}

interface CashTransaction {
    id: string;
    type: 'Sangria' | 'Suprimento' | 'Venda';
    amount: number;
    description: string;
    created_at: string;
    users?: { name: string };
}

export default function CaixaPage() {
    const [currentRegister, setCurrentRegister] = useState<CashRegister | null>(null);
    const [transactions, setTransactions] = useState<CashTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);

    // Modals
    const [isOpeningModalOpen, setIsOpeningModalOpen] = useState(false);
    const [initialBalanceForm, setInitialBalanceForm] = useState('');

    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [transactionForm, setTransactionForm] = useState({
        type: 'Sangria' as 'Sangria' | 'Suprimento',
        amount: '',
        description: ''
    });

    const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);

    useEffect(() => {
        fetchInitialData();
    }, []);

    async function fetchInitialData() {
        try {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setUserId(session.user.id);
            }

            // Check if there is an open register
            const { data: register } = await supabase
                .from('cash_registers')
                .select('*')
                .eq('status', 'Aberto')
                .single();

            if (register) {
                setCurrentRegister(register);
                fetchTransactions(register.id);
            } else {
                setCurrentRegister(null);
                setTransactions([]);
            }
        } catch (error) {
            console.error('Error fetching cash register:', error);
        } finally {
            setLoading(false);
        }
    }

    async function fetchTransactions(registerId: string) {
        const { data, error } = await supabase
            .from('cash_transactions')
            .select('*')
            .eq('cash_register_id', registerId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Erro ao buscar transações:", error);
            return;
        }

        if (data) {
            // Busca nomes dos funcionários separadamente para evitar erro de Foreign Key do auth.users
            const userIds = [...new Set(data.map(t => t.user_id))];
            if (userIds.length > 0) {
                const { data: emps } = await supabase.from('employees').select('id, name').in('id', userIds);
                if (emps) {
                    data.forEach(t => {
                        t.users = { name: emps.find(e => e.id === t.user_id)?.name || 'Desconhecido' };
                    });
                }
            }
            setTransactions(data);
        }
    }

    async function handleOpenRegister(e: React.FormEvent) {
        e.preventDefault();
        if (!userId) return;

        const amount = parseFloat(initialBalanceForm.replace(',', '.'));
        if (isNaN(amount) || amount < 0) {
            alert('Insira um valor válido de Fundo de Troco.');
            return;
        }

        try {
            const { error } = await supabase
                .from('cash_registers')
                .insert([{
                    opened_by: userId,
                    initial_balance: amount,
                    status: 'Aberto'
                }]);

            if (error) throw error;
            setIsOpeningModalOpen(false);
            setInitialBalanceForm('');
            fetchInitialData();
        } catch (error) {
            console.error('Error opening register:', error);
            alert('Erro ao abrir caixa.');
        }
    }

    async function handleCreateTransaction(e: React.FormEvent) {
        e.preventDefault();
        if (!userId || !currentRegister) return;

        const amount = parseFloat(transactionForm.amount.replace(',', '.'));
        if (isNaN(amount) || amount <= 0) {
            alert('Insira um valor válido.');
            return;
        }

        if (!transactionForm.description) {
            alert('A descrição é obrigatória (Ex: Pagamento fornecedor, Troco extr).');
            return;
        }

        try {
            const { error } = await supabase
                .from('cash_transactions')
                .insert([{
                    cash_register_id: currentRegister.id,
                    user_id: userId,
                    type: transactionForm.type,
                    amount: amount,
                    description: transactionForm.description
                }]);

            if (error) throw error;
            setIsTransactionModalOpen(false);
            setTransactionForm({ type: 'Sangria', amount: '', description: '' });
            fetchTransactions(currentRegister.id);
        } catch (error) {
            console.error('Error creating transaction:', error);
            alert('Erro ao registrar lançamento.');
        }
    }

    async function handleCloseRegister() {
        if (!userId || !currentRegister) return;

        // Calculate expected final balance
        const totalVendas = transactions.filter(t => t.type === 'Venda').reduce((acc, curr) => acc + curr.amount, 0);
        const totalSuprimentos = transactions.filter(t => t.type === 'Suprimento').reduce((acc, curr) => acc + curr.amount, 0);
        const totalSangrias = transactions.filter(t => t.type === 'Sangria').reduce((acc, curr) => acc + curr.amount, 0);
        const expectedFinalBalance = currentRegister.initial_balance + totalVendas + totalSuprimentos - totalSangrias;

        if (!confirm(`O saldo final esperado é R$ ${expectedFinalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.\n\nVocê tem certeza que deseja FECHAR o caixa agora? Após fechado, nenhuma venda poderá ser finalizada até que um novo caixa seja aberto.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('cash_registers')
                .update({
                    status: 'Fechado',
                    closed_at: new Date().toISOString(),
                    closed_by: userId,
                    final_balance: expectedFinalBalance
                })
                .eq('id', currentRegister.id);

            if (error) throw error;
            setIsClosingModalOpen(false);
            fetchInitialData();
        } catch (error) {
            console.error('Error closing register:', error);
            alert('Erro ao fechar caixa.');
        }
    }


    if (loading) {
        return (
            <AppLayout>
                <div className="flex h-[80vh] items-center justify-center">
                    <p className="text-gray-500 font-medium animate-pulse">Carregando dados do caixa...</p>
                </div>
            </AppLayout>
        );
    }

    // Calculations for open register dashboard
    const totalVendas = transactions.filter(t => t.type === 'Venda').reduce((acc, curr) => acc + curr.amount, 0);
    const totalSuprimentos = transactions.filter(t => t.type === 'Suprimento').reduce((acc, curr) => acc + curr.amount, 0);
    const totalSangrias = transactions.filter(t => t.type === 'Sangria').reduce((acc, curr) => acc + curr.amount, 0);
    const currentBalance = currentRegister ? currentRegister.initial_balance + totalVendas + totalSuprimentos - totalSangrias : 0;


    return (
        <AppLayout>
            <div className="max-w-5xl mx-auto space-y-6">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div>
                        <h2 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                            <Wallet className="text-red-600" />
                            Controle de Caixa
                        </h2>
                        <p className="text-gray-500 font-medium">Abertura, Lançamentos e Fechamento Diário.</p>
                    </div>
                    {currentRegister ? (
                        <div className="flex gap-2">
                            <Button onClick={() => setIsTransactionModalOpen(true)} className="bg-gray-900 border-gray-900 text-white hover:bg-gray-800">
                                <Minus size={18} className="mr-1.5" /> Lançar Despesa
                            </Button>
                            <Button onClick={() => setIsClosingModalOpen(true)} className="bg-red-600 hover:bg-red-700 font-bold border-none">
                                Fechar Caixa
                            </Button>
                        </div>
                    ) : (
                        <Button onClick={() => setIsOpeningModalOpen(true)} className="bg-green-600 hover:bg-green-700 text-white border-green-600 font-bold text-lg px-8 py-6">
                            <Plus size={24} className="mr-2" /> Abrir Novo Caixa
                        </Button>
                    )}
                </header>

                {!currentRegister ? (
                    <Card className="border-dashed border-2 bg-transparent shadow-none border-gray-300 items-center justify-center min-h-[40vh] flex flex-col text-center p-8">
                        <Wallet size={80} className="text-gray-300 mb-6" />
                        <h3 className="text-2xl font-black text-gray-400 mb-2">Caixa Fechado</h3>
                        <p className="text-gray-500 max-w-sm mb-6">Nenhuma venda pode ser realizada no momento. Clique no botão acima para abrir um novo caixa com um fundo de troco.</p>
                    </Card>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Card className="bg-white">
                                <CardContent className="p-6">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Fundo de Troco</p>
                                    <p className="text-2xl font-black text-gray-900">R$ {currentRegister.initial_balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-white">
                                <CardContent className="p-6">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1"><TrendingUp size={14} className="text-green-500" /> Vendas Hoje</p>
                                    <p className="text-2xl font-black text-green-600">+ R$ {totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-white">
                                <CardContent className="p-6">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1"><TrendingDown size={14} className="text-red-500" /> Sangrias / Saídas</p>
                                    <p className="text-2xl font-black text-red-600">- R$ {totalSangrias.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-gray-900 text-white border-gray-900 shadow-xl">
                                <CardContent className="p-6">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Saldo em Caixa Esperado</p>
                                    <p className="text-3xl font-black text-white">R$ {currentBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader className="border-b bg-gray-50/50 pb-4">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <History size={20} className="text-gray-500" />
                                    Últimas Movimentações
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0 overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 border-b border-gray-100">
                                        <tr>
                                            <th className="p-4 font-bold">Tipo</th>
                                            <th className="p-4 font-bold">Data / Hora</th>
                                            <th className="p-4 font-bold">Descrição</th>
                                            <th className="p-4 font-bold">Usuário</th>
                                            <th className="p-4 font-bold text-right">Valor</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {transactions.length === 0 ? (
                                            <tr><td colSpan={5} className="p-8 text-center text-gray-400">Nenhuma movimentação registrada neste caixa ainda.</td></tr>
                                        ) : transactions.map(t => (
                                            <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="p-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider ${t.type === 'Venda' ? 'bg-green-100 text-green-700' :
                                                        t.type === 'Suprimento' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-red-100 text-red-700'
                                                        }`}>
                                                        {t.type}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-sm text-gray-500 font-medium">
                                                    {new Date(t.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="p-4 text-sm text-gray-900 font-bold">{t.description || '-'}</td>
                                                <td className="p-4 text-sm text-gray-500">{t.users?.name || 'Sistema'}</td>
                                                <td className={`p-4 text-right font-black ${t.type === 'Sangria' ? 'text-red-600' : 'text-green-600'
                                                    }`}>
                                                    {t.type === 'Sangria' ? '-' : '+'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                    </>
                )}

                {/* Modal Abertura de Caixa */}
                {isOpeningModalOpen && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <Card className="w-full max-w-sm animate-in zoom-in-95 duration-200 border-none shadow-2xl">
                            <CardHeader className="border-b border-gray-100 pb-4 bg-gray-50 rounded-t-xl">
                                <CardTitle className="text-xl">Abrir Caixa</CardTitle>
                            </CardHeader>
                            <form onSubmit={handleOpenRegister}>
                                <CardContent className="p-6 space-y-4">
                                    <div className="flex items-start gap-3 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm font-medium mb-4">
                                        <AlertCircle size={20} className="shrink-0 mt-0.5" />
                                        <p>Todas as vendas de hoje serão vinculadas a este caixa. Informe o fundo de troco inicial.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-black text-gray-700 mb-1">Fundo de Troco (R$)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            required
                                            min="0"
                                            className="w-full px-4 py-3 text-lg font-bold border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                            placeholder="Ex: 100.00"
                                            value={initialBalanceForm}
                                            onChange={e => setInitialBalanceForm(e.target.value)}
                                        />
                                    </div>

                                    <div className="flex gap-3 pt-4">
                                        <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsOpeningModalOpen(false)}>Cancelar</Button>
                                        <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white">Confirmar Abertura</Button>
                                    </div>
                                </CardContent>
                            </form>
                        </Card>
                    </div>
                )}

                {/* Modal Lançamento (Sangria/Suprimento) */}
                {isTransactionModalOpen && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <Card className="w-full max-w-sm animate-in zoom-in-95 duration-200 border-none shadow-2xl">
                            <CardHeader className="border-b border-gray-100 pb-4 bg-gray-50 rounded-t-xl">
                                <CardTitle className="text-xl">Novo Lançamento</CardTitle>
                            </CardHeader>
                            <form onSubmit={handleCreateTransaction}>
                                <CardContent className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-black text-gray-700 mb-1">Tipo de Lançamento</label>
                                        <div className="flex gap-2">
                                            <div
                                                className={`flex-1 p-3 text-center rounded-lg border-2 cursor-pointer font-bold ${transactionForm.type === 'Sangria' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-100 hover:border-gray-200 text-gray-500'}`}
                                                onClick={() => setTransactionForm({ ...transactionForm, type: 'Sangria' })}
                                            >
                                                Sangria <span className="block text-[10px] font-normal opacity-70">Saída de Dinheiro</span>
                                            </div>
                                            <div
                                                className={`flex-1 p-3 text-center rounded-lg border-2 cursor-pointer font-bold ${transactionForm.type === 'Suprimento' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 hover:border-gray-200 text-gray-500'}`}
                                                onClick={() => setTransactionForm({ ...transactionForm, type: 'Suprimento' })}
                                            >
                                                Suprimento <span className="block text-[10px] font-normal opacity-70">Entrada (Reforço)</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-black text-gray-700 mb-1">Valor (R$)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            required
                                            min="0"
                                            className="w-full px-4 py-3 text-lg font-bold border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none"
                                            placeholder="Ex: 50.00"
                                            value={transactionForm.amount}
                                            onChange={e => setTransactionForm({ ...transactionForm, amount: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-black text-gray-700 mb-1">Descrição do Lançamento</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none"
                                            placeholder="Ex: Pagamento do Gelo"
                                            value={transactionForm.description}
                                            onChange={e => setTransactionForm({ ...transactionForm, description: e.target.value })}
                                        />
                                    </div>

                                    <div className="flex gap-3 pt-4">
                                        <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsTransactionModalOpen(false)}>Cancelar</Button>
                                        <Button type="submit" className={`flex-1 text-white ${transactionForm.type === 'Sangria' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                            Registrar {transactionForm.type}
                                        </Button>
                                    </div>
                                </CardContent>
                            </form>
                        </Card>
                    </div>
                )}

                {/* Modal Fechar Caixa */}
                {isClosingModalOpen && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <Card className="w-full max-w-sm animate-in zoom-in-95 duration-200 border-none shadow-2xl">
                            <CardHeader className="border-b border-gray-100 pb-4 bg-red-50 rounded-t-xl text-red-900">
                                <CardTitle className="text-xl">Encerrar Expediente</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4">
                                <div className="text-center py-6 bg-gray-50 rounded-xl border border-gray-100">
                                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">Saldo a ser conferido</p>
                                    <p className="text-4xl font-black text-gray-900">R$ {currentBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </div>
                                <p className="text-sm text-gray-500 text-center font-medium px-2">
                                    Após fechar o caixa, nenhuma venda ou sangria poderá ser lançada neste turno.
                                </p>

                                <div className="flex flex-col gap-3 pt-4">
                                    <Button onClick={handleCloseRegister} className="w-full bg-red-600 hover:bg-red-700 font-bold text-lg py-6 shadow-lg shadow-red-200">
                                        Sim, Fechar as Contas
                                    </Button>
                                    <Button variant="ghost" className="w-full py-4 text-gray-500" onClick={() => setIsClosingModalOpen(false)}>
                                        Voltar
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

            </div>
        </AppLayout>
    );
}
