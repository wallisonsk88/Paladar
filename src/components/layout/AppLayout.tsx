import { ReactNode } from 'react';
import Link from 'next/link';
import { Home, Table2, Package, Users, BarChart3, Settings } from 'lucide-react';

interface LayoutProps {
    children: ReactNode;
}

export default function AppLayout({ children }: LayoutProps) {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
            {/* Sidebar for Desktop */}
            <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200">
                <div className="p-6">
                    <h1 className="text-2xl font-bold text-red-600">Novo Paladar</h1>
                    <p className="text-xs text-gray-500 mt-1">Controle de Mesas & Vendas</p>
                </div>

                <nav className="flex-1 px-4 py-4 space-y-2">
                    <NavLink href="/" icon={<Home size={20} />} label="Dashboard" />
                    <NavLink href="/mesas" icon={<Table2 size={20} />} label="Mesas" />
                    <NavLink href="/produtos" icon={<Package size={20} />} label="Produtos" />
                    <NavLink href="/clientes" icon={<Users size={20} />} label="Clientes" />
                    <NavLink href="/relatorios" icon={<BarChart3 size={20} />} label="Relatórios" />
                </nav>

                <div className="p-4 border-t border-gray-200">
                    <NavLink href="/configuracoes" icon={<Settings size={20} />} label="Configurações" />
                </div>
            </aside>

            {/* Bottom Nav for Mobile */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2 z-50">
                <MobileNavLink href="/" icon={<Home size={24} />} label="Home" />
                <MobileNavLink href="/mesas" icon={<Table2 size={24} />} label="Mesas" />
                <MobileNavLink href="/produtos" icon={<Package size={24} />} label="Produtos" />
                <MobileNavLink href="/clientes" icon={<Users size={24} />} label="Clientes" />
                <MobileNavLink href="/dashboard" icon={<BarChart3 size={24} />} label="Relatórios" />
            </nav>

            {/* Main Content */}
            <main className="flex-1 pb-20 md:pb-0 overflow-auto h-screen">
                <header className="md:hidden bg-white p-4 border-b border-gray-200 sticky top-0 z-40">
                    <h1 className="text-xl font-bold text-red-600">Novo Paladar</h1>
                </header>
                <div className="p-4 md:p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}

function NavLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
    return (
        <Link
            href={href}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
            {icon}
            <span className="font-medium">{label}</span>
        </Link>
    );
}

function MobileNavLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
    return (
        <Link
            href={href}
            className="flex flex-col items-center gap-1 text-gray-500 hover:text-red-600 transition-colors px-2 py-1"
        >
            {icon}
            <span className="text-[10px] uppercase font-bold">{label}</span>
        </Link>
    );
}
