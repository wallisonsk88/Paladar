'use client';

import AppLayout from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { DollarSign, CreditCard, Users, Table2 } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [stats, setStats] = useState({
    sales: 0,
    received: 0,
    debt: 0,
    occupiedTables: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      setLoading(true);

      // 1. Occupied Tables
      const { count: occupiedCount } = await supabase
        .from('tables')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Ocupada');

      // 2. Total Debt (Fiado)
      const { data: customerData } = await supabase
        .from('customers')
        .select('total_debt');
      const totalDebt = customerData?.reduce((acc, c) => acc + (c.total_debt || 0), 0) || 0;

      // 3. Sales Today (simplified as sum of all paid orders today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: ordersToday } = await supabase
        .from('orders')
        .select('total_amount, payment_method')
        .gte('created_at', today.toISOString());

      const totalSales = ordersToday?.reduce((acc, o) => acc + (o.total_amount || 0), 0) || 0;
      const totalReceived = ordersToday
        ?.filter(o => o.payment_method !== 'Fiado')
        .reduce((acc, o) => acc + (o.total_amount || 0), 0) || 0;
      const totalFiadoToday = ordersToday
        ?.filter(o => o.payment_method === 'Fiado')
        .reduce((acc, o) => acc + (o.total_amount || 0), 0) || 0;

      setStats({
        sales: totalSales,
        received: totalReceived,
        debt: totalDebt,
        occupiedTables: occupiedCount || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-500">Bem-vindo ao Novo Paladar. Veja o resumo de hoje.</p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatsCard
            title="Vendas Hoje"
            value={`R$ ${stats.sales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={<DollarSign className="text-green-600" />}
            color="bg-green-100"
          />
          <StatsCard
            title="Recebido Hoje"
            value={`R$ ${stats.received.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={<CreditCard className="text-blue-600" />}
            color="bg-blue-100"
          />
          <StatsCard
            title="Fiado Total"
            value={`R$ ${stats.debt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={<Users className="text-orange-600" />}
            color="bg-orange-100"
          />
          <StatsCard
            title="Mesas Ocupadas"
            value={stats.occupiedTables.toString()}
            icon={<Table2 className="text-red-600" />}
            color="bg-red-100"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Mesas em Destaque</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Módulo de mesas será carregado aqui...</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Últimos Pedidos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Histórico recente de vendas...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

function StatsCard({ title, value, icon, color }: { title: string; value: string; icon: ReactNode; color: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
            <h3 className="text-2xl font-bold">{value}</h3>
          </div>
          <div className={`${color} p-3 rounded-full`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

