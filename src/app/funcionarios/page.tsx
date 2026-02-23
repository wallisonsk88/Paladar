'use client';

import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, Button, CardHeader, CardTitle } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { Plus, Shield, User, Trash2, Edit2, KeyRound } from 'lucide-react';

interface Employee {
    id: string;
    name: string;
    role: string;
    active: boolean;
    created_at: string;
}

export default function FuncionariosPage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    // Formulário de novo funcionário (Sign Up)
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'garcom'
    });

    const [adminUserId, setAdminUserId] = useState<string | null>(null);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [selectedEmployeeForPassword, setSelectedEmployeeForPassword] = useState<Employee | null>(null);
    const [newPasswordForm, setNewPasswordForm] = useState('');
    const [resetting, setResetting] = useState(false);

    useEffect(() => {
        const getSession = async () => {
            const { data } = await supabase.auth.getSession();
            if (data.session) {
                setAdminUserId(data.session.user.id);
            }
        };
        getSession();
        fetchEmployees();
    }, []);

    async function fetchEmployees() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('employees')
                .select('*')
                .order('created_at', { ascending: true });

            if (error) throw error;
            setEmployees(data || []);
        } catch (error) {
            console.error('Error fetching employees:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleResetPassword(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedEmployeeForPassword || !adminUserId) return;

        if (newPasswordForm.length < 6) {
            alert('A senha deve ter no mínimo 6 caracteres.');
            return;
        }

        try {
            setResetting(true);

            const response = await fetch('/api/admin/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetUserId: selectedEmployeeForPassword.id,
                    newPassword: newPasswordForm,
                    adminUserId: adminUserId
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao trocar senha.');
            }

            alert(`Senha de ${selectedEmployeeForPassword.name} alterada com sucesso!`);
            setIsPasswordModalOpen(false);
            setNewPasswordForm('');
            setSelectedEmployeeForPassword(null);

        } catch (error: any) {
            console.error('Erro no catch:', error);
            alert(`Falha: ${error.message}`);
        } finally {
            setResetting(false);
        }
    }

    async function handleCreateEmployee(e: React.FormEvent) {
        e.preventDefault();
        try {
            setSaving(true);

            // Usamos um cliente temporário para não deslogar o Admin atual
            const tempSupabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                { auth: { persistSession: false, autoRefreshToken: false } }
            );

            const { data, error } = await tempSupabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        name: formData.name,
                        role: formData.role
                    }
                }
            });

            if (error) throw error;

            alert('Funcionário cadastrado com sucesso! Use o e-mail e senha cadastrados para fazer login.');

            setIsModalOpen(false);
            setFormData({ name: '', email: '', password: '', role: 'garcom' });
            fetchEmployees();
        } catch (error: any) {
            console.error('Error creating employee:', error);
            alert(`Erro ao criar funcionário: ${error.message}`);
        } finally {
            setSaving(false);
        }
    }

    async function handleToggleStatus(id: string, currentStatus: boolean) {
        if (!confirm(`Deseja realmente ${currentStatus ? 'desativar' : 'ativar'} este funcionário?`)) return;

        const { error } = await supabase
            .from('employees')
            .update({ active: !currentStatus })
            .eq('id', id);

        if (!error) fetchEmployees();
    }

    async function handleChangeRole(id: string, currentRole: string) {
        const newRole = prompt('Digite o novo cargo (admin, caixa, garcom):', currentRole);
        if (!newRole || newRole === currentRole) return;

        if (!['admin', 'caixa', 'garcom'].includes(newRole.toLowerCase())) {
            alert('Cargo inválido! Use apenas: admin, caixa ou garcom.');
            return;
        }

        const { error } = await supabase
            .from('employees')
            .update({ role: newRole.toLowerCase() })
            .eq('id', id);

        if (!error) {
            fetchEmployees();
        } else {
            alert('Erro ao atualizar cargo.');
        }
    }

    return (
        <AppLayout>
            <div className="max-w-5xl mx-auto">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h2 className="text-3xl font-black text-gray-900">Funcionários</h2>
                        <p className="text-gray-500 font-medium">Gerencie o acesso da sua equipe ao sistema.</p>
                    </div>
                    <Button onClick={() => setIsModalOpen(true)} className="bg-gray-900 hover:bg-gray-800">
                        <Plus size={20} />
                        Cadastrar Integrante
                    </Button>
                </header>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-bold">
                                    <th className="p-4">Nome</th>
                                    <th className="p-4 hidden md:table-cell">Cargo / Permissão</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-gray-400">Carregando equipe...</td>
                                    </tr>
                                ) : employees.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-gray-400">Nenhum funcionário encontrado.</td>
                                    </tr>
                                ) : employees.map(emp => (
                                    <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold">
                                                    {emp.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900">{emp.name}</p>
                                                    <p className="text-xs text-gray-400 md:hidden uppercase mt-0.5">{emp.role}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 hidden md:table-cell">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase ${emp.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                                emp.role === 'caixa' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-orange-100 text-orange-700'
                                                }`}>
                                                {emp.role === 'admin' ? <Shield size={12} /> : <User size={12} />}
                                                {emp.role}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase ${emp.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${emp.active ? 'bg-green-600' : 'bg-red-600'}`}></span>
                                                {emp.active ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    className="p-2 h-auto text-amber-600 hover:bg-amber-50"
                                                    onClick={() => {
                                                        setSelectedEmployeeForPassword(emp);
                                                        setIsPasswordModalOpen(true);
                                                    }}
                                                    title="Mudar Senha"
                                                >
                                                    <KeyRound size={16} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    className="p-2 h-auto text-blue-600 hover:bg-blue-50"
                                                    onClick={() => handleChangeRole(emp.id, emp.role)}
                                                    title="Mudar cargo"
                                                >
                                                    <Edit2 size={16} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    className={`p-2 h-auto ${emp.active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                                                    onClick={() => handleToggleStatus(emp.id, emp.active)}
                                                    title={emp.active ? 'Desativar acesso' : 'Reativar acesso'}
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Modal de Cadastro */}
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <Card className="w-full max-w-md animate-in zoom-in-95 duration-200 border-none shadow-2xl">
                            <CardHeader className="border-b border-gray-100 pb-4">
                                <CardTitle className="text-xl">Novo Funcionário</CardTitle>
                            </CardHeader>
                            <form onSubmit={handleCreateEmployee}>
                                <CardContent className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Nome Completo</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                                            placeholder="Ex: Carlos Silva"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">E-mail de Login</label>
                                        <input
                                            type="email"
                                            required
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                                            placeholder="carlos@novopaladar.com"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        />
                                        <p className="text-[10px] text-gray-400 mt-1">Este e-mail será usado para entrar no sistema.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Senha Provisória</label>
                                        <input
                                            type="password"
                                            required
                                            minLength={6}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                                            placeholder="Mínimo 6 caracteres"
                                            value={formData.password}
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Cargo / Permissão</label>
                                        <select
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none uppercase text-sm font-bold"
                                            value={formData.role}
                                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                                        >
                                            <option value="garcom">Garçom (Apenas Mesas)</option>
                                            <option value="caixa">Caixa (Mesas e Clientes)</option>
                                            <option value="admin">Administrador (Acesso Total)</option>
                                        </select>
                                    </div>

                                    <div className="flex gap-3 pt-4">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            className="flex-1"
                                            onClick={() => setIsModalOpen(false)}
                                            disabled={saving}
                                        >
                                            Cancelar
                                        </Button>
                                        <Button
                                            type="submit"
                                            className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
                                            disabled={saving}
                                        >
                                            {saving ? 'Criando...' : 'Criar Acesso'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </form>
                        </Card>
                    </div>
                )}

                {/* Modal de Nova Senha */}
                {isPasswordModalOpen && selectedEmployeeForPassword && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <Card className="w-full max-w-sm animate-in zoom-in-95 duration-200 border-none shadow-2xl">
                            <CardHeader className="border-b border-gray-100 pb-4 bg-amber-50 rounded-t-xl text-amber-900">
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <KeyRound size={20} />
                                    Redefinir Senha
                                </CardTitle>
                            </CardHeader>
                            <form onSubmit={handleResetPassword}>
                                <CardContent className="p-6 space-y-4">
                                    <p className="text-sm text-gray-600">
                                        Digite uma nova senha para o acesso de <b>{selectedEmployeeForPassword.name}</b>.
                                    </p>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Nova Senha</label>
                                        <input
                                            type="password"
                                            required
                                            minLength={6}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                                            placeholder="Mínimo 6 caracteres"
                                            value={newPasswordForm}
                                            onChange={e => setNewPasswordForm(e.target.value)}
                                        />
                                    </div>

                                    <div className="flex gap-3 pt-4">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            className="flex-1"
                                            onClick={() => {
                                                setIsPasswordModalOpen(false);
                                                setNewPasswordForm('');
                                            }}
                                            disabled={resetting}
                                        >
                                            Cancelar
                                        </Button>
                                        <Button
                                            type="submit"
                                            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                                            disabled={resetting}
                                        >
                                            {resetting ? 'Salvando...' : 'Salvar Senha'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </form>
                        </Card>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
