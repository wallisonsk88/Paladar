'use client';

import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, Button, CardHeader, CardTitle } from '@/components/ui/Card';
import { Customer } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { Plus, Search, Phone, History, AlertCircle } from 'lucide-react';

export default function ClientesPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [formData, setFormData] = useState({ name: '', phone: '', limit: '0', obs: '' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchCustomers();
    }, []);

    async function fetchCustomers() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .order('name', { ascending: true });

            if (error) {
                console.error('Error fetching customers:', error);
            } else {
                setCustomers(data || []);
            }
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveCustomer(e: React.FormEvent) {
        e.preventDefault();
        try {
            setSaving(true);
            const limit = parseFloat(formData.limit.replace(',', '.'));

            if (editingCustomer) {
                const { error } = await supabase
                    .from('customers')
                    .update({
                        name: formData.name,
                        phone: formData.phone,
                        credit_limit: limit,
                        observations: formData.obs
                    })
                    .eq('id', editingCustomer.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('customers')
                    .insert([{
                        name: formData.name,
                        phone: formData.phone,
                        credit_limit: limit,
                        total_debt: 0,
                        observations: formData.obs
                    }]);
                if (error) throw error;
            }

            setIsModalOpen(false);
            setEditingCustomer(null);
            setFormData({ name: '', phone: '', limit: '0', obs: '' });
            fetchCustomers();
        } catch (error) {
            console.error('Error saving customer:', error);
            alert('Erro ao salvar cliente.');
        } finally {
            setSaving(false);
        }
    }

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm)
    );

    const totalToReceive = customers.reduce((acc, c) => acc + (c.total_debt || 0), 0);

    return (
        <AppLayout>
            <div className="max-w-7xl mx-auto">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900">Clientes</h2>
                        <p className="text-gray-500">Gerencie o cadastro de clientes e controle de fiados.</p>
                    </div>
                    <Button onClick={() => {
                        setEditingCustomer(null);
                        setFormData({ name: '', phone: '', limit: '0', obs: '' });
                        setIsModalOpen(true);
                    }}>
                        <Plus size={20} />
                        Novo Cliente
                    </Button>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <Card>
                            <CardContent className="py-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                    <input
                                        type="text"
                                        placeholder="Buscar por nome ou telefone..."
                                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {loading ? (
                                <p className="col-span-full text-center py-12 text-gray-500">Carregando clientes...</p>
                            ) : filteredCustomers.length === 0 ? (
                                <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                                    <p className="text-gray-500">Nenhum cliente encontrado.</p>
                                </div>
                            ) : (
                                filteredCustomers.map((customer) => (
                                    <CustomerCard
                                        key={customer.id}
                                        customer={customer}
                                        onEdit={() => {
                                            setEditingCustomer(customer);
                                            setFormData({
                                                name: customer.name,
                                                phone: customer.phone || '',
                                                limit: customer.credit_limit.toString(),
                                                obs: customer.observations || ''
                                            });
                                            setIsModalOpen(true);
                                        }}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <Card className="bg-red-600 text-white border-none">
                            <CardContent className="p-6">
                                <h3 className="text-lg font-medium opacity-90 mb-1">Total Geral a Receber</h3>
                                <div className="text-4xl font-black mb-4">
                                    R$ {totalToReceive.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </div>
                                <p className="text-sm opacity-80">Soma de todos os fiados pendentes no sistema.</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <AlertCircle className="text-orange-500" size={20} />
                                    Maiores Devedores
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {customers
                                        .filter(c => c.total_debt > 0)
                                        .sort((a, b) => b.total_debt - a.total_debt)
                                        .slice(0, 5)
                                        .map((customer) => (
                                            <div key={customer.id} className="flex justify-between items-center pb-2 border-b border-gray-50 last:border-0 last:pb-0">
                                                <div>
                                                    <p className="font-semibold text-gray-900">{customer.name}</p>
                                                    <p className="text-xs text-gray-500 font-medium">Limite: R$ {customer.credit_limit.toLocaleString('pt-BR')}</p>
                                                </div>
                                                <span className="font-bold text-red-600">
                                                    R$ {customer.total_debt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        ))
                                    }
                                    {customers.filter(c => c.total_debt > 0).length === 0 && (
                                        <p className="text-sm text-gray-500 italic text-center">Nenhum débito pendente.</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <Card className="w-full max-w-md animate-in zoom-in-95 duration-200">
                            <CardHeader>
                                <CardTitle>{editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}</CardTitle>
                            </CardHeader>
                            <form onSubmit={handleSaveCustomer}>
                                <CardContent className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Nome Completo</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                                            placeholder="Ex: João Silva"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Telefone</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                                            placeholder="(00) 00000-0000"
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Limite de Fiado (R$)</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                                            placeholder="0,00"
                                            value={formData.limit}
                                            onChange={e => setFormData({ ...formData, limit: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Observações</label>
                                        <textarea
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none min-h-[100px]"
                                            placeholder="Ex: Cliente antigo do bairro..."
                                            value={formData.obs}
                                            onChange={e => setFormData({ ...formData, obs: e.target.value })}
                                        />
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
                                            className="flex-1"
                                            disabled={saving}
                                        >
                                            {saving ? 'Salvando...' : 'Salvar'}
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

function CustomerCard({ customer, onEdit }: { customer: Customer, onEdit: () => void }) {
    const isCloseToLimit = customer.total_debt >= (customer.credit_limit * 0.8);

    return (
        <Card className="hover:border-red-200 transition-colors cursor-pointer" onClick={onEdit}>
            <CardContent className="p-5">
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <h4 className="font-bold text-gray-900 text-lg leading-tight">{customer.name}</h4>
                        {customer.phone && (
                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                <Phone size={12} />
                                {customer.phone}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" className="p-1.5 h-auto" title="Histórico">
                            <History size={16} />
                        </Button>
                    </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 flex justify-between items-center">
                    <div>
                        <p className="text-[10px] uppercase font-bold text-gray-400">Dívida Atual</p>
                        <p className={`text-lg font-black ${customer.total_debt > 0 ? "text-red-600" : "text-green-600"}`}>
                            R$ {customer.total_debt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-gray-400">Limite</p>
                        <p className="text-sm font-semibold text-gray-700">
                            R$ {customer.credit_limit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>

                {isCloseToLimit && customer.total_debt > 0 && (
                    <div className="mt-2 text-[10px] text-orange-600 font-bold flex items-center gap-1">
                        <AlertCircle size={10} />
                        CLIENTE PRÓXIMO AO LIMITE DE FIADO
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
