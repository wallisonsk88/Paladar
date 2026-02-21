'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, Button, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, Product, Order, OrderItem, Customer } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { Plus, Minus, Trash2, CheckCircle, ArrowLeft, CreditCard, DollarSign, Wallet, Users, Search, Loader2 } from 'lucide-react';

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

    useEffect(() => {
        fetchData();
    }, [id]);

    async function fetchData() {
        try {
            setLoading(true);

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
        if (orderItems.length === 0 || !currentOrder) return;
        if (paymentMethod === 'Fiado' && !selectedCustomer) {
            alert('Selecione um cliente para a venda fiada.');
            return;
        }

        try {
            setFinalizing(true);

            // 1. Update the order to Paid
            const { error: orderError } = await supabase
                .from('orders')
                .update({
                    customer_id: selectedCustomer?.id || null,
                    total_amount: totalAmount,
                    status: 'Pago',
                    payment_method: paymentMethod,
                    closed_at: new Date().toISOString()
                })
                .eq('id', currentOrder.id);

            if (orderError) throw orderError;

            // 2. Handle Debt if it's "Fiado"
            if (paymentMethod === 'Fiado' && selectedCustomer) {
                const { error: debtError } = await supabase.from('debts').insert([{
                    customer_id: selectedCustomer.id,
                    order_id: currentOrder.id,
                    amount: totalAmount,
                    status: 'Pendente'
                }]);
                if (debtError) throw debtError;

                // Update customer total debt
                const { error: custError } = await supabase
                    .from('customers')
                    .update({ total_debt: (selectedCustomer.total_debt || 0) + totalAmount })
                    .eq('id', selectedCustomer.id);
                if (custError) throw custError;
            }

            // 3. Update Table back to Livre
            const { error: tableError } = await supabase
                .from('tables')
                .update({ status: 'Livre', customer_name: null, opened_at: null })
                .eq('id', id);
            if (tableError) throw tableError;

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
                                    <Button onClick={() => setIsClosing(true)} className="px-12 py-4 text-xl">
                                        Fechar Mesa
                                    </Button>
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

                {/* Modal Fechamento (Mock) */}
                {isClosing && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <Card className="w-full max-w-lg animate-in zoom-in-95 duration-200">
                            <CardHeader>
                                <CardTitle className="text-2xl">Finalizar Pagamento</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="mb-6 text-center py-8 bg-gray-50 rounded-2xl">
                                    <p className="text-sm text-gray-500 uppercase font-black tracking-widest mb-1">Total a Pagar</p>
                                    <p className="text-5xl font-black text-red-600">R$ {totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <PaymentCard
                                        icon={<DollarSign size={24} />}
                                        label="Dinheiro"
                                        active={paymentMethod === 'Dinheiro'}
                                        onClick={() => setPaymentMethod('Dinheiro')}
                                    />
                                    <PaymentCard
                                        icon={<CreditCard size={24} />}
                                        label="Cartão"
                                        active={paymentMethod === 'Cartão'}
                                        onClick={() => setPaymentMethod('Cartão')}
                                    />
                                    <PaymentCard
                                        icon={<Wallet size={24} />}
                                        label="Pix"
                                        active={paymentMethod === 'Pix'}
                                        onClick={() => setPaymentMethod('Pix')}
                                    />
                                    <PaymentCard
                                        icon={<Users size={24} />}
                                        label="Fiado"
                                        color="text-orange-600"
                                        active={paymentMethod === 'Fiado'}
                                        onClick={() => setPaymentMethod('Fiado')}
                                    />
                                </div>

                                {paymentMethod === 'Fiado' && (
                                    <div className="mb-8 space-y-4 animate-in slide-in-from-top-2 duration-200">
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
                                            <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex justify-between items-center">
                                                <div>
                                                    <p className="font-bold text-orange-900">{selectedCustomer.name}</p>
                                                    <p className="text-xs text-orange-700">Débito atual: R$ {selectedCustomer.total_debt.toLocaleString('pt-BR')}</p>
                                                </div>
                                                <Button variant="ghost" onClick={() => setSelectedCustomer(null)}>Trocar</Button>
                                            </div>
                                        ) : (
                                            <div className="max-h-40 overflow-auto border border-gray-100 rounded-lg">
                                                {filteredCustomers.slice(0, 5).map(c => (
                                                    <div
                                                        key={c.id}
                                                        className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-0"
                                                        onClick={() => setSelectedCustomer(c)}
                                                    >
                                                        <p className="font-semibold text-gray-900">{c.name}</p>
                                                        <p className="text-xs text-gray-500">{c.phone}</p>
                                                    </div>
                                                ))}
                                                {customerSearch && filteredCustomers.length === 0 && (
                                                    <p className="p-4 text-center text-gray-500 text-sm italic">Nenhum cliente encontrado.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex gap-4">
                                    <Button
                                        variant="secondary"
                                        className="flex-1 py-4"
                                        onClick={() => setIsClosing(false)}
                                        disabled={finalizing}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        className="flex-1 py-4 text-lg"
                                        onClick={handleConfirmPayment}
                                        disabled={finalizing || (paymentMethod === 'Fiado' && !selectedCustomer)}
                                    >
                                        {finalizing ? 'Finalizando...' : 'Confirmar'}
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
