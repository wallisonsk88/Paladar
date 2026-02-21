'use client';

import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, Button } from '@/components/ui/Card';
import { Table } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { Plus, Coffee, Info, AlertTriangle, Users, Edit2, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function MesasPage() {
    const [tables, setTables] = useState<Table[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'open' | 'edit'>('add');
    const [selectedTable, setSelectedTable] = useState<Table | null>(null);
    const [formData, setFormData] = useState({ number: '', customerName: '' });

    useEffect(() => {
        fetchTables();

        // Set up realtime listener
        const channel = supabase
            .channel('schema-db-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, (payload) => {
                console.log('Change received!', payload);
                fetchTables();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    async function fetchTables() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('tables')
                .select('*')
                .order('number', { ascending: true });

            if (error) {
                console.error('Error fetching tables:', error);
            } else {
                setTables(data || []);
            }
        } finally {
            setLoading(false);
        }
    }

    async function handleDeleteTable(id: string) {
        if (!confirm('Tem certeza que deseja excluir esta mesa?')) return;

        try {
            setLoading(true);
            const { error } = await supabase.from('tables').delete().eq('id', id);
            if (error) throw error;
            fetchTables();
        } catch (error) {
            console.error('Error deleting table:', error);
            alert('Erro ao excluir mesa. Verifique se ela possui pedidos vinculados.');
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveTable(e: React.FormEvent) {
        e.preventDefault();
        try {
            setAdding(true);
            const num = parseInt(formData.number);

            // Validation: Unique table number (if adding new)
            if (modalMode === 'add' && tables.some(t => t.number === num)) {
                alert('Já existe uma mesa com este número.');
                return;
            }

            if (modalMode === 'add') {
                const { error } = await supabase
                    .from('tables')
                    .insert([{
                        number: num,
                        status: 'Livre',
                        customer_name: formData.customerName || null
                    }]);
                if (error) throw error;
            } else if (selectedTable) {
                const updateData: any = {};
                if (modalMode === 'edit') {
                    updateData.number = num;
                } else {
                    // Just updating customer name, status remains Livre until products are added
                    updateData.customer_name = formData.customerName;
                }

                const { error } = await supabase
                    .from('tables')
                    .update(updateData)
                    .eq('id', selectedTable.id);
                if (error) throw error;
            }

            setIsModalOpen(false);
            setFormData({ number: '', customerName: '' });
            fetchTables();
        } catch (error) {
            console.error('Error saving table:', error);
            alert('Erro ao salvar mesa.');
        } finally {
            setAdding(false);
        }
    }

    return (
        <AppLayout>
            <div className="max-w-7xl mx-auto">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900">Gerenciamento de Mesas</h2>
                        <p className="text-gray-500">Visualize e controle o atendimento do salão.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => {
                            const nextNum = tables.length > 0 ? Math.max(...tables.map(t => t.number)) + 1 : 1;
                            setModalMode('add');
                            setFormData({ number: nextNum.toString(), customerName: '' });
                            setIsModalOpen(true);
                        }}>
                            <Plus size={20} />
                            Nova Mesa
                        </Button>
                    </div>
                </header>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {tables.map((table) => (
                        <TableCard
                            key={table.id}
                            table={table}
                            onOpen={() => {
                                setModalMode('open');
                                setSelectedTable(table);
                                setFormData({ number: table.number.toString(), customerName: '' });
                                setIsModalOpen(true);
                            }}
                            onEdit={() => {
                                setModalMode('edit');
                                setSelectedTable(table);
                                setFormData({ number: table.number.toString(), customerName: table.customer_name || '' });
                                setIsModalOpen(true);
                            }}
                            onDelete={() => handleDeleteTable(table.id)}
                        />
                    ))}
                </div>

                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <Card className="w-full max-w-sm animate-in zoom-in-95 duration-200">
                            <CardContent className="p-6">
                                <h3 className="text-xl font-bold mb-4">
                                    {modalMode === 'add' ? 'Adicionar Nova Mesa' :
                                        modalMode === 'edit' ? `Editar Mesa ${selectedTable?.number}` :
                                            `Abrir Mesa ${selectedTable?.number}`}
                                </h3>
                                <form onSubmit={handleSaveTable} className="space-y-4">
                                    {(modalMode === 'add' || modalMode === 'edit') && (
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Número da Mesa</label>
                                            <input
                                                type="number"
                                                required
                                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                                                value={formData.number}
                                                onChange={e => setFormData({ ...formData, number: e.target.value })}
                                            />
                                        </div>
                                    )}
                                    {modalMode !== 'edit' && (
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Nome do Cliente (Opcional)</label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                                                placeholder="Ex: João Silva"
                                                value={formData.customerName}
                                                onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                                                autoFocus={modalMode === 'open'}
                                            />
                                        </div>
                                    )}
                                    <div className="flex gap-3 pt-4">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            className="flex-1"
                                            onClick={() => setIsModalOpen(false)}
                                        >
                                            Cancelar
                                        </Button>
                                        <Button
                                            type="submit"
                                            className="flex-1"
                                            disabled={adding}
                                        >
                                            {adding ? 'Salvando...' : 'Confirmar'}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function TableCard({ table, onOpen, onEdit, onDelete }: { table: Table, onOpen: () => void, onEdit: () => void, onDelete: () => void }) {
    const statusColors = {
        'Livre': 'bg-green-50 border-green-200 text-green-700',
        'Ocupada': 'bg-red-50 border-red-200 text-red-700',
        'Fechamento pendente': 'bg-orange-50 border-orange-200 text-orange-700',
    };

    const statusIcons = {
        'Livre': <Coffee size={24} />,
        'Ocupada': <Users size={24} />,
        'Fechamento pendente': <Info size={24} />,
    };

    const hasCustomer = !!table.customer_name;
    const isLivre = table.status === 'Livre';

    const Content = (
        <Card className={`h-full border-2 transition-transform relative group active:scale-95 cursor-pointer ${statusColors[table.status]}`}
            onClick={(!isLivre || (isLivre && !hasCustomer)) ? undefined : undefined /* controlled by Link or nested click */}>
            <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-2">
                {/* Actions overlay */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }}
                        className="p-1.5 bg-white/80 hover:bg-white rounded-full shadow-sm text-gray-600 transition-colors"
                        title="Configurar mesa"
                    >
                        <Edit2 size={14} />
                    </button>
                    {isLivre && !hasCustomer && (
                        <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
                            className="p-1.5 bg-white/80 hover:bg-red-50 hover:text-red-600 rounded-full shadow-sm text-gray-600 transition-colors"
                            title="X"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>

                <div className="text-sm font-bold uppercase tracking-wider mb-1">Mesa {table.number}</div>
                <div className="p-3 bg-white rounded-full shadow-sm">
                    {statusIcons[table.status]}
                </div>
                <div className="mt-2 font-semibold">{table.status}</div>
                {table.customer_name && (
                    <div className="text-xs opacity-80 mt-1 truncate max-w-full">
                        {table.customer_name}
                    </div>
                )}
            </CardContent>
        </Card>
    );

    // Navigate to details if occupied OR if it's a Livre table with an assigned customer
    if (!isLivre || hasCustomer) {
        return <Link href={`/mesas/${table.id}`}>{Content}</Link>;
    }

    // Completely empty and Livre: clicking opens the configuration modal
    return (
        <div onClick={onOpen}>
            {Content}
        </div>
    );
}
