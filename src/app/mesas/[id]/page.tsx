'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, Button, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, Product, Order, OrderItem, Customer } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { Plus, Minus, Trash2, CheckCircle, ArrowLeft, CreditCard, DollarSign, Wallet, Users, Search, Loader2 } from 'lucide-react';

interface PartialPayment {
    id: string; // unique local ID
    method: 'Dinheiro' | 'Cartão' | 'Pix' | 'Fiado';
    amount: number;
    customerId?: string;
    customerName?: string;
}

export default function MesaDetalhesPage() {
    const { id } = useParams();
    const router = useRouter();
    const [table, setTable] = useState<Table | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isClosing, setIsClosing] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'Dinheiro' | 'Cartão' | 'Pix' | 'Fiado'>('Dinheiro');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [finalizing, setFinalizing] = useState(false);
    const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);

    // Multi-Payment State
    const [paymentsList, setPaymentsList] = useState<PartialPayment[]>([]);
    const [partialAmountInput, setPartialAmountInput] = useState('');


    useEffect(() => {
        fetchData();
    }, [id]);

    async function fetchData() {
        try {
            setLoading(true);

            // Fetch session context for cash register tracking and permissions
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData.session) {
                setUserId(sessionData.session.user.id);
                setUserRole(sessionData.session.user.user_metadata?.role || 'garcom');
            }

            // Fetch table
            const { data: tableData, error: tableError } = await supabase.from('tables').select('*').eq('id', id).single();

            if (tableData) {
                setTable(tableData);
            } else if (typeof id === 'string' && id.startsWith('00000000-0000')) {
                // Fallback for mock IDs during development
                const tableNumber = parseInt(id.split('-').pop() || '0');
                setTable({
                    id: id,
                    number: tableNumber,
                    status: 'Livre',
                    created_at: '2024-01-01T00:00:00.000Z'
                });
            }

            // Fetch active products
            const { data: productsData } = await supabase.from('products').select('*').eq('active', true).order('name');
            if (productsData) setProducts(productsData);

            // Fetch customers for checkout
            const { data: customersData } = await supabase.from('customers').select('*').order('name');
            if (customersData) setCustomers(customersData);

            // Fetch active order for this table
            const { data: orderData } = await supabase
                .from('orders')
                .select('*')
                .eq('table_id', id)
                .eq('status', 'Aberto')
                .single();

            if (orderData) {
                setCurrentOrder(orderData);
                // Fetch items for this order
                const { data: itemsData } = await supabase
                    .from('order_items')
                    .select('*, product:products(*)')
                    .eq('order_id', orderData.id);
                if (itemsData) setOrderItems(itemsData);
            }

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleConfirmPayment() {
        // Validation: must have exactly the total amount paid
        const totalPaid = paymentsList.reduce((acc, p) => acc + p.amount, 0);
        const difference = Math.abs(totalAmount - totalPaid);
        if (difference > 0.01) {
            alert('A soma dos pagamentos não corresponde ao valor total do pedido.');
            return;
        }

        if (orderItems.length === 0 || !currentOrder) return;

        try {
            setFinalizing(true);

            // Verify if there is an open cash register (Caixa)
            const { data: openRegister } = await supabase
                .from('cash_registers')
                .select('id')
                .eq('status', 'Aberto')
                .single();

            const registerId = openRegister ? openRegister.id : null;

            // 1. Update the order to Paid
            // Determine primary payment method name (Orders table CHECK constraint doesn't allow 'Misto')
            const sortedPayments = [...paymentsList].sort((a, b) => b.amount - a.amount);
            const dominantMethod = sortedPayments.length > 0 ? sortedPayments[0].method : 'Dinheiro';

            // If there's a Fiado payment, log the customer id of the FIRST Fiado 
            // (mainly for legacy support on the orders table. Best practice is to rely on debts table)
            const firstFiado = paymentsList.find(p => p.method === 'Fiado');

            const { error: orderError } = await supabase
                .from('orders')
                .update({
                    customer_id: firstFiado?.customerId || null,
                    total_amount: totalAmount,
                    status: 'Pago',
                    payment_method: dominantMethod,
                    closed_at: new Date().toISOString()
                })
                .eq('id', currentOrder.id);

            if (orderError) throw orderError;

            let whatsappMessages = [];

            // 2. Iterate and process each Partial Payment
            for (const payment of paymentsList) {
                if (payment.method === 'Fiado' && payment.customerId) {
                    // Create Debt
                    const { error: debtError } = await supabase.from('debts').insert([{
                        customer_id: payment.customerId,
                        order_id: currentOrder.id,
                        amount: payment.amount,
                        status: 'Pendente'
                    }]);
                    if (debtError) throw debtError;

                    // Fetch and update customer total debt
                    const { data: customerData } = await supabase.from('customers').select('total_debt, phone, name').eq('id', payment.customerId).single();
                    if (customerData) {
                        const newDebt = (customerData.total_debt || 0) + payment.amount;
                        await supabase.from('customers').update({ total_debt: newDebt }).eq('id', payment.customerId);

                        // Queue WA Message
                        if (customerData.phone) {
                            whatsappMessages.push({
                                phone: customerData.phone.replace(/\D/g, ''),
                                name: customerData.name,
                                addedAmount: payment.amount,
                                newTotalDebt: newDebt
                            });
                        }
                    }
                } else {
                    // It's a Cash/Card/Pix payment, insert into cash_transactions if a register is open
                    if (registerId && userId) {
                        await supabase.from('cash_transactions').insert([{
                            cash_register_id: registerId,
                            user_id: userId,
                            type: 'Venda',
                            amount: payment.amount,
                            description: `Venda Mesa ${table?.number} (${payment.method})`
                        }]);
                    }
                    // If no register is open, it won't be tracked in the daily POS, but the order is still paid.
                }
            }

            // 3. Update Table back to Livre
            const { error: tableError } = await supabase
                .from('tables')
                .update({ status: 'Livre', customer_name: null, opened_at: null })
                .eq('id', id);
            if (tableError) throw tableError;

            // 4. Send WhatsApp Receipts
            for (const msg of whatsappMessages) {
                let itemsText = orderItems.map(item => `- ${item.quantity}x ${item.product?.name}`).join('%0A');
                const message = `Olá *${msg.name}*, tudo bem?%0A%0AAqui é do *Novo Paladar*.%0A%0AInformamos que uma conta da Mesa ${table?.number} foi fechada, e a sua parte foi anotada na nota.%0A%0A*Valor Adicionado:* R$ ${msg.addedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}%0A*Itens da Mesa:*%0A${itemsText}%0A%0A*Seu saldo devedor ATUALIZADO:* R$ ${msg.newTotalDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}%0A%0AAgradecemos a preferência!`;
                const whatsappUrl = `https://wa.me/55${msg.phone}?text=${message}`;
                // Using window.open in a loop might get blocked by browsers, but we will keep the standard behavior for the first one generally.
                window.open(whatsappUrl, '_blank');
            }

            alert('Mesa fechada com sucesso!');
            router.push('/mesas');
        } catch (error) {
            console.error('Error finalizing order:', error);
            alert('Erro ao finalizar pedido.');
        } finally {
            setFinalizing(false);
        }
    }

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase())
    );

    const totalAmount = orderItems.reduce((acc, item) => acc + item.total_price, 0);
    const totalPaid = paymentsList.reduce((acc, p) => acc + p.amount, 0);
    const remainingAmount = Math.max(0, totalAmount - totalPaid);

    useEffect(() => {
        // Automatically set the partial amount input to the remaining amount
        setPartialAmountInput(remainingAmount.toFixed(2));
    }, [remainingAmount, paymentMethod]);

    const addPartialPayment = () => {
        const amt = parseFloat(partialAmountInput.replace(',', '.'));
        if (isNaN(amt) || amt <= 0) {
            alert('Por favor, informe um valor válido para este pagamento.');
            return;
        }

        if (amt > remainingAmount + 0.05) { // allow tiny float imperfects
            alert('O valor do pagamento não pode ser maior que o restante a pagar.');
            return;
        }

        if (paymentMethod === 'Fiado' && !selectedCustomer) {
            alert('Por favor, selecione um cliente para lançar o Fiado.');
            return;
        }

        const newPayment: PartialPayment = {
            id: Math.random().toString(36).substr(2, 9),
            method: paymentMethod,
            amount: amt,
            customerId: paymentMethod === 'Fiado' ? selectedCustomer?.id : undefined,
            customerName: paymentMethod === 'Fiado' ? selectedCustomer?.name : undefined
        };

        setPaymentsList([...paymentsList, newPayment]);
        setSelectedCustomer(null);
        setCustomerSearch('');
    };

    const removePartialPayment = (paymentId: string) => {
        setPaymentsList(paymentsList.filter(p => p.id !== paymentId));
    };

    const addItem = async (product: Product) => {
        try {
            let orderId = currentOrder?.id;

            // 1. Create Order and Update Table status if first item
            if (!orderId) {
                const { data: newOrder, error: orderError } = await supabase
                    .from('orders')
                    .insert([{
                        table_id: id,
                        status: 'Aberto',
                        total_amount: 0
                    }])
                    .select()
                    .single();

                if (orderError) throw orderError;
                orderId = newOrder.id;
                setCurrentOrder(newOrder);

                // Update table to Ocupada
                await supabase.from('tables').update({ status: 'Ocupada', opened_at: new Date().toISOString() }).eq('id', id);
            }

            const existing = orderItems.find(item => item.product_id === product.id);
            if (existing) {
                const newQty = existing.quantity + 1;
                const newTotal = newQty * existing.unit_price;

                const { error } = await supabase
                    .from('order_items')
                    .update({ quantity: newQty, total_price: newTotal })
                    .eq('id', existing.id);

                if (error) throw error;
                setOrderItems(orderItems.map(item => item.id === existing.id ? { ...item, quantity: newQty, total_price: newTotal } : item));
            } else {
                const { data: newItem, error } = await supabase
                    .from('order_items')
                    .insert([{
                        order_id: orderId,
                        product_id: product.id,
                        quantity: 1,
                        unit_price: product.price,
                        total_price: product.price
                    }])
                    .select('*, product:products(*)')
                    .single();

                if (error) throw error;
                setOrderItems([...orderItems, newItem]);
            }
        } catch (error) {
            console.error('Error adding item:', error);
            alert('Erro ao adicionar produto.');
        }
    };

    const removeItem = async (productId: string) => {
        try {
            const existing = orderItems.find(item => item.product_id === productId);
            if (!existing || !currentOrder) return;

            if (existing.quantity > 1) {
                const newQty = existing.quantity - 1;
                const newTotal = newQty * existing.unit_price;
                const { error } = await supabase
                    .from('order_items')
                    .update({ quantity: newQty, total_price: newTotal })
                    .eq('id', existing.id);
                if (error) throw error;
                setOrderItems(orderItems.map(item => item.id === existing.id ? { ...item, quantity: newQty, total_price: newTotal } : item));
            } else {
                const { error } = await supabase.from('order_items').delete().eq('id', existing.id);
                if (error) throw error;
                const newItems = orderItems.filter(item => item.id !== existing.id);
                setOrderItems(newItems);

                // If no items left, set table back to Livre and delete empty order
                if (newItems.length === 0) {
                    await supabase.from('tables').update({ status: 'Livre', opened_at: null }).eq('id', id);
                    await supabase.from('orders').delete().eq('id', currentOrder.id);
                    setCurrentOrder(null);
                }
            }
        } catch (error) {
            console.error('Error removing item:', error);
        }
    };

    return (
        <AppLayout>
            <div className="max-w-7xl mx-auto">
                <div className="mb-6 flex items-center gap-4">
                    <Button variant="ghost" onClick={() => router.push('/mesas')}>
                        <ArrowLeft size={20} />
                        Voltar
                    </Button>
                    <div>
                        <h2 className="text-3xl font-black text-gray-900 leading-none">Mesa {table?.number || '-'}</h2>
                        <div className="mt-1 flex items-center gap-2">
                            <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${table?.status === 'Livre' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                {table?.status || 'Carregando...'}
                            </span>
                            {table?.customer_name && <span className="text-sm text-gray-500 font-medium">| {table.customer_name}</span>}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Order Content */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="min-h-[400px] flex flex-col">
                            <CardHeader className="bg-gray-50 flex flex-row items-center justify-between">
                                <CardTitle>Pedido Atual</CardTitle>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total do Pedido</p>
                                    <p className="text-2xl font-black text-red-600">R$ {totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-auto p-0">
                                {orderItems.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-40">
                                        <CheckCircle size={64} className="mb-4 text-green-600" />
                                        <p className="text-xl font-bold">Mesa Vazia</p>
                                        <p>Adicione produtos para começar o pedido.</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-400 border-b">
                                            <tr>
                                                <th className="px-6 py-3">Produto</th>
                                                <th className="px-6 py-3 text-center">Qtd</th>
                                                <th className="px-6 py-3 text-right">Subtotal</th>
                                                <th className="px-6 py-3 text-right">Ação</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {orderItems.map((item) => (
                                                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <p className="font-bold text-gray-900">{item.product?.name}</p>
                                                        <p className="text-xs text-gray-400">R$ {item.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} un.</p>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-center gap-3">
                                                            <button onClick={() => removeItem(item.product_id)} className="p-1 rounded-full hover:bg-red-100 text-red-600">
                                                                <Minus size={16} />
                                                            </button>
                                                            <span className="font-bold text-lg w-6 text-center">{item.quantity}</span>
                                                            <button onClick={() => addItem(item.product as Product)} className="p-1 rounded-full hover:bg-green-100 text-green-600">
                                                                <Plus size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-black text-gray-900">
                                                        R$ {item.total_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button className="text-gray-300 hover:text-red-500">
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </CardContent>
                            {orderItems.length > 0 && (
                                <div className="p-6 border-t bg-gray-50 flex justify-end">
                                    {(userRole === 'admin' || userRole === 'caixa') ? (
                                        <Button onClick={() => setIsClosing(true)} className="px-12 py-4 text-xl">
                                            Fechar Mesa
                                        </Button>
                                    ) : (
                                        <p className="text-sm font-bold text-gray-400">Apenas Caixa pode fechar a mesa.</p>
                                    )}
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* Product Selection */}
                    <div className="space-y-6">
                        <Card className="h-[calc(100vh-200px)] flex flex-col">
                            <CardHeader>
                                <CardTitle>Escolher Produtos</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-auto p-4 space-y-2">
                                {products.map((product) => (
                                    <div
                                        key={product.id}
                                        onClick={() => addItem(product)}
                                        className="flex justify-between items-center p-3 rounded-xl border border-gray-100 hover:border-red-500 hover:bg-red-50 cursor-pointer transition-all active:scale-95 bg-white shadow-sm"
                                    >
                                        <div>
                                            <p className="font-bold text-gray-900">{product.name}</p>
                                            <p className="text-sm font-black text-red-600">R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <div className="bg-red-100 text-red-600 p-2 rounded-lg">
                                            <Plus size={20} />
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Modal Fechamento */}
                {isClosing && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
                        <Card className="w-full max-w-2xl animate-in zoom-in-95 duration-200 border-none shadow-2xl flex flex-col max-h-[90vh]">
                            <CardHeader className="bg-gray-50 border-b shrink-0 rounded-t-xl">
                                <CardTitle className="text-2xl flex items-center justify-between">
                                    Finalizar Pagamento
                                    <span className="text-sm bg-gray-200 px-3 py-1 rounded-full text-gray-700 font-bold">Resumo: R$ {totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0 overflow-hidden flex flex-col md:flex-row flex-1 min-h-0">

                                {/* Left Side: Add Payment */}
                                <div className="flex-1 p-6 border-b md:border-b-0 md:border-r border-gray-100 overflow-y-auto">
                                    <h3 className="font-bold text-gray-700 mb-4 tracking-tight">Como deseja pagar o restante?</h3>

                                    <div className="grid grid-cols-2 gap-3 mb-6">
                                        <PaymentCard
                                            icon={<DollarSign size={20} />}
                                            label="Dinheiro"
                                            active={paymentMethod === 'Dinheiro'}
                                            onClick={() => setPaymentMethod('Dinheiro')}
                                        />
                                        <PaymentCard
                                            icon={<CreditCard size={20} />}
                                            label="Cartão"
                                            active={paymentMethod === 'Cartão'}
                                            onClick={() => setPaymentMethod('Cartão')}
                                        />
                                        <PaymentCard
                                            icon={<Wallet size={20} />}
                                            label="Pix"
                                            active={paymentMethod === 'Pix'}
                                            onClick={() => setPaymentMethod('Pix')}
                                        />
                                        <PaymentCard
                                            icon={<Users size={20} />}
                                            label="Fiado"
                                            color="text-orange-600"
                                            active={paymentMethod === 'Fiado'}
                                            onClick={() => setPaymentMethod('Fiado')}
                                        />
                                    </div>

                                    {paymentMethod === 'Fiado' && (
                                        <div className="mb-6 space-y-4 animate-in fade-in duration-200 bg-orange-50/50 p-4 rounded-xl border border-orange-100">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                <input
                                                    type="text"
                                                    placeholder="Buscar cliente para fiado..."
                                                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                                                    value={customerSearch}
                                                    onChange={e => setCustomerSearch(e.target.value)}
                                                />
                                            </div>

                                            {selectedCustomer ? (
                                                <div className="p-3 bg-white border border-orange-200 shadow-sm rounded-xl flex justify-between items-center">
                                                    <div>
                                                        <p className="font-bold text-orange-900 leading-tight">{selectedCustomer.name}</p>
                                                        <p className="text-[10px] text-orange-700 font-bold uppercase mt-0.5">Dívida: R$ {selectedCustomer.total_debt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                    </div>
                                                    <Button variant="ghost" onClick={() => setSelectedCustomer(null)} className="h-8 text-xs">Trocar</Button>
                                                </div>
                                            ) : (
                                                <div className="max-h-32 overflow-auto border border-white rounded-lg bg-white shadow-inner">
                                                    {filteredCustomers.slice(0, 5).map(c => (
                                                        <div
                                                            key={c.id}
                                                            className="p-3 hover:bg-orange-50 cursor-pointer border-b border-gray-50 last:border-0"
                                                            onClick={() => setSelectedCustomer(c)}
                                                        >
                                                            <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                                                        </div>
                                                    ))}
                                                    {customerSearch && filteredCustomers.length === 0 && (
                                                        <p className="p-4 text-center text-gray-500 text-sm italic">Nenhum cliente encontrado.</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <div className="flex-1 relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">R$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={partialAmountInput}
                                                onChange={(e) => setPartialAmountInput(e.target.value)}
                                                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-0 outline-none text-lg font-black"
                                                disabled={remainingAmount === 0}
                                            />
                                        </div>
                                        <Button
                                            onClick={addPartialPayment}
                                            disabled={remainingAmount === 0 || (paymentMethod === 'Fiado' && !selectedCustomer)}
                                            className="bg-gray-900 hover:bg-gray-800 text-white font-bold px-6"
                                        >
                                            Inserir
                                        </Button>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2 text-center uppercase tracking-wider font-bold">
                                        Faltam: R$ {remainingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>

                                {/* Right Side: Summary & Confirm */}
                                <div className="flex-1 bg-gray-50 p-6 flex flex-col">
                                    <h3 className="font-bold text-gray-700 mb-4 tracking-tight flex items-center justify-between">
                                        Composição do Pagamento
                                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{paymentsList.length} partes</span>
                                    </h3>

                                    <div className="flex-1 overflow-y-auto mb-6 space-y-2 min-h-[150px]">
                                        {paymentsList.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50 space-y-2">
                                                <Wallet size={40} />
                                                <p className="text-sm text-center">Nenhum pagamento<br />lancado ainda.</p>
                                            </div>
                                        ) : (
                                            paymentsList.map(p => (
                                                <div key={p.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-100 shadow-sm animate-in fade-in slide-in-from-right-4">
                                                    <div>
                                                        <p className="font-bold text-gray-900 text-sm">{p.method}</p>
                                                        {p.customerName && <p className="text-[10px] uppercase font-bold text-orange-600">{p.customerName}</p>}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <p className="font-black text-gray-900">R$ {p.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                        <button onClick={() => removePartialPayment(p.id)} className="text-red-400 hover:text-red-600 transition-colors p-1">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    <div className="pt-4 border-t border-gray-200 mt-auto">
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="text-gray-500 font-medium">Pago até agora</span>
                                            <span className="text-xl font-black text-green-600">
                                                R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>

                                        <div className="flex gap-3">
                                            <Button
                                                variant="secondary"
                                                className="w-1/3"
                                                onClick={() => {
                                                    setIsClosing(false);
                                                    setPaymentsList([]);
                                                }}
                                                disabled={finalizing}
                                            >
                                                Voltar
                                            </Button>
                                            <Button
                                                className={`flex-1 text-lg font-bold shadow-xl ${remainingAmount === 0 ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                                                onClick={handleConfirmPayment}
                                                disabled={finalizing || remainingAmount > 0}
                                            >
                                                {finalizing ? 'Finalizando...' : 'Concluir Pedido'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function PaymentCard({ icon, label, active, onClick, color = "text-gray-700" }: { icon: any, label: string, active?: boolean, onClick: () => void, color?: string }) {
    return (
        <div
            onClick={onClick}
            className={`flex flex-col items-center justify-center p-6 border-2 rounded-2xl cursor-pointer transition-all active:scale-95 group bg-white shadow-sm ${active ? 'border-red-500 bg-red-50 ring-2 ring-red-100' : 'border-gray-100 hover:border-red-200'
                }`}
        >
            <div className={`${active ? 'text-red-600' : color} mb-2 group-hover:text-red-600`}>{icon}</div>
            <span className={`font-bold ${active ? 'text-red-600' : 'text-gray-900'} group-hover:text-red-600`}>{label}</span>
        </div>
    );
}
