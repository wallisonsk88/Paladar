'use client';

import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';
import { BarChart3, TrendingUp, Users, Calendar, ArrowRightLeft, Loader2 } from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';

export default function RelatoriosPage() {
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState('7d'); // '7d', '30d', 'all'

    // Métricas principais
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [totalOrders, setTotalOrders] = useState(0);
    const [activeClients, setActiveClients] = useState(0);
    const [averageTicket, setAverageTicket] = useState(0);

    // Dados para os gráficos
    const [dailyRevenue, setDailyRevenue] = useState<{ date: string, value: number }[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<{ method: string, value: number }[]>([]);
    const [topProducts, setTopProducts] = useState<{ name: string, quantity: number, total: number }[]>([]);

    useEffect(() => {
        fetchReportData();
    }, [dateRange]);

    async function fetchReportData() {
        try {
            setLoading(true);

            // Determinar a data de corte
            let startDate = new Date();
            if (dateRange === '7d') startDate.setDate(startDate.getDate() - 7);
            else if (dateRange === '30d') startDate.setDate(startDate.getDate() - 30);
            else startDate = new Date(2000, 0, 1); // effectively 'all'

            // Buscar Pedidos Fechados no período
            const { data: orders, error: ordersError } = await supabase
                .from('orders')
                .select('id, total_amount, payment_method, closed_at')
                .eq('status', 'Pago')
                .gte('closed_at', startDate.toISOString())
                .order('closed_at', { ascending: true });

            if (ordersError) throw ordersError;

            // Busca os Itens para produtos mais vendidos
            const { data: items, error: itemsError } = await supabase
                .from('order_items')
                .select(`
                    quantity,
                    total_price,
                    order_id,
                    orders!inner(status, closed_at),
                    products(name)
                `)
                .eq('orders.status', 'Pago')
                .gte('orders.closed_at', startDate.toISOString());

            if (itemsError) throw itemsError;

            // Busca total de Clientes ativos
            const { count: clientsCount } = await supabase
                .from('customers')
                .select('*', { count: 'exact', head: true });

            // =========== PROCESSAMENTO DE DADOS ===========

            const ordersList = orders || [];
            const revenue = ordersList.reduce((acc, order) => acc + (order.total_amount || 0), 0);

            setTotalRevenue(revenue);
            setTotalOrders(ordersList.length);
            setActiveClients(clientsCount || 0);
            setAverageTicket(ordersList.length > 0 ? revenue / ordersList.length : 0);

            // 1. Receita Diária (Gráfico de Linha/Área)
            const dailyData: Record<string, number> = {};
            ordersList.forEach(order => {
                const date = new Date(order.closed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                dailyData[date] = (dailyData[date] || 0) + (order.total_amount || 0);
            });
            const revenueChartData = Object.keys(dailyData).map(k => ({ date: k, value: dailyData[k] }));
            setDailyRevenue(revenueChartData);

            // 2. Métodos de Pagamento (Gráfico de Barras)
            const methodsData: Record<string, number> = {};
            ordersList.forEach(order => {
                const method = order.payment_method || 'Desconhecido';
                methodsData[method] = (methodsData[method] || 0) + (order.total_amount || 0);
            });
            setPaymentMethods(Object.keys(methodsData).map(k => ({ method: k, value: methodsData[k] })));

            // 3. Produtos Mais Vendidos
            const productsData: Record<string, { q: number, t: number }> = {};
            (items || []).forEach(item => {
                // @ts-ignore
                const name = item.products?.name || 'Produto Removido';
                if (!productsData[name]) productsData[name] = { q: 0, t: 0 };
                productsData[name].q += item.quantity;
                productsData[name].t += item.total_price;
            });

            const topRanking = Object.keys(productsData)
                .map(k => ({ name: k, quantity: productsData[k].q, total: productsData[k].t }))
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, 5); // top 5

            setTopProducts(topRanking);

        } catch (error) {
            console.error('Erro ao buscar relatórios:', error);
        } finally {
            setLoading(false);
        }
    }

    // Funcção de formatação para os Tooltips dos gráficos
    const formatCurrency = (value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    if (loading) {
        return (
            <AppLayout>
                <div className="flex h-[80vh] items-center justify-center">
                    <Loader2 className="animate-spin text-red-600 mb-4" size={48} />
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Cabeçalho */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h2 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                            <BarChart3 className="text-red-600" />
                            Relatório de Desempenho
                        </h2>
                        <p className="text-gray-500 font-medium">Análise de vendas, pagamentos e produtos.</p>
                    </div>

                    <div className="flex bg-white rounded-lg shadow-sm border border-gray-100 p-1">
                        <button
                            onClick={() => setDateRange('7d')}
                            className={`px-4 py-2 rounded-md font-bold text-sm transition-colors ${dateRange === '7d' ? 'bg-red-50 text-red-700' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            Últimos 7 Dias
                        </button>
                        <button
                            onClick={() => setDateRange('30d')}
                            className={`px-4 py-2 rounded-md font-bold text-sm transition-colors ${dateRange === '30d' ? 'bg-red-50 text-red-700' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            Últimos 30 Dias
                        </button>
                        <button
                            onClick={() => setDateRange('all')}
                            className={`px-4 py-2 rounded-md font-bold text-sm transition-colors ${dateRange === 'all' ? 'bg-red-50 text-red-700' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            Todo Período
                        </button>
                    </div>
                </header>

                {/* Cards de Métricas (KPIs) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-none shadow-md overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={64} /></div>
                        <CardContent className="p-6 relative z-10">
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Faturamento Bruto</p>
                            <h3 className="text-3xl font-black text-green-600">
                                R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </h3>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-md overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><Calendar size={64} /></div>
                        <CardContent className="p-6 relative z-10">
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Pedidos Fechados</p>
                            <h3 className="text-3xl font-black text-gray-900">
                                {totalOrders}
                            </h3>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-md overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><ArrowRightLeft size={64} /></div>
                        <CardContent className="p-6 relative z-10">
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Ticket Médio</p>
                            <h3 className="text-3xl font-black text-blue-600">
                                R$ {averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </h3>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-md overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><Users size={64} /></div>
                        <CardContent className="p-6 relative z-10">
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Cadastros</p>
                            <h3 className="text-3xl font-black text-amber-600">
                                {activeClients} <span className="text-sm font-medium text-amber-600/60 uppercase tracking-normal">Clientes</span>
                            </h3>
                        </CardContent>
                    </Card>
                </div>

                {/* Gráficos Principais */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">

                    {/* Gráfico 1: Faturamento Diário */}
                    <Card className="lg:col-span-2 shadow-sm border-gray-100">
                        <CardHeader className="border-b border-gray-50 pb-4">
                            <CardTitle className="text-lg">Faturamento por Dia</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="h-[300px] w-full">
                                {dailyRevenue.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={dailyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(val) => `R$ ${val}`} />
                                            <Tooltip formatter={(value: any) => [formatCurrency(value as number), 'Faturamento']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                            <Area type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-gray-400">Dados insuficientes para este período.</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Gráfico 2: Formas de Pagamento */}
                    <Card className="shadow-sm border-gray-100">
                        <CardHeader className="border-b border-gray-50 pb-4">
                            <CardTitle className="text-lg">Formas de Pagamento</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="h-[300px] w-full">
                                {paymentMethods.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={paymentMethods} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="method" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13, fontWeight: 'bold' }} width={80} />
                                            <Tooltip formatter={(value: any) => [formatCurrency(value as number), 'Valor Movimentado']} cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                            <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={24} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-gray-400">Nenhum pagamento registrado.</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabela: Top Produtos */}
                <Card className="shadow-sm border-gray-100 overflow-hidden mt-6">
                    <CardHeader className="bg-gray-50 border-b border-gray-100 pb-4">
                        <CardTitle className="text-lg">Top 5 Produtos Mais Vendidos</CardTitle>
                    </CardHeader>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-white border-b border-gray-100 text-xs uppercase text-gray-500 font-bold">
                                <tr>
                                    <th className="p-4">Produto</th>
                                    <th className="p-4 text-center">Unidades Vendidas</th>
                                    <th className="p-4 text-right">Renda Gerada</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 bg-white">
                                {topProducts.length === 0 ? (
                                    <tr><td colSpan={3} className="p-6 text-center text-gray-400">Nenhuma venda registrada.</td></tr>
                                ) : topProducts.map((prod, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 font-bold text-gray-900">{prod.name}</td>
                                        <td className="p-4 text-center">
                                            <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-bold">
                                                {prod.quantity}x
                                            </span>
                                        </td>
                                        <td className="p-4 text-right font-black text-green-600">
                                            {formatCurrency(prod.total)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>

            </div>
        </AppLayout>
    );
}
