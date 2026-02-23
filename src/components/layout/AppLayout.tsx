'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Home, Table2, Package, Users, BarChart3, Settings, LogOut, Loader2, UserCog, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface LayoutProps {
    children: ReactNode;
}

export default function AppLayout({ children }: LayoutProps) {
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState<string | null>(null);
    const [userName, setUserName] = useState<string>('');
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        checkAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (!session && event === 'SIGNED_OUT') {
                router.push('/login');
            }
        });

        return () => subscription.unsubscribe();
    }, [router]);

    async function checkAuth() {
        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                router.push('/login');
                return;
            }

            // Fetch employee role
            const { data: employee, error } = await supabase
                .from('employees')
                .select('name, role')
                .eq('id', session.user.id)
                .single();

            if (employee) {
                setRole(employee.role);
                setUserName(employee.name);
            } else {
                // Failsafe if employee record doesn't exist yet but user is logged in
                setRole('admin');
                setUserName(session.user.user_metadata?.name || 'Usuário');
            }
        } catch (error) {
            console.error('Auth check error:', error);
        } finally {
            setLoading(false);
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-red-600 mb-4" size={48} />
                <p className="text-gray-500 font-medium">Carregando sistema...</p>
            </div>
        );
    }

    const isAdmin = role === 'admin';
    const isCaixa = role === 'caixa' || isAdmin;

    // Check strict route access
    if (!isAdmin && (pathname.startsWith('/produtos') || pathname.startsWith('/funcionarios') || pathname.startsWith('/relatorios') || pathname.startsWith('/configuracoes'))) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 max-w-md">
                    <h2 className="text-2xl font-black text-red-600 mb-2">Acesso Negado</h2>
                    <p className="text-gray-600 mb-6">Seu perfil de <b>{role}</b> não tem permissão para acessar esta página.</p>
                    <button onClick={() => router.push('/')} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition">
                        Voltar para o Início
                    </button>
                </div>
            </div>
        );
    }

    if (role === 'garcom' && pathname.startsWith('/clientes')) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 max-w-md">
                    <h2 className="text-2xl font-black text-red-600 mb-2">Acesso Negado</h2>
                    <p className="text-gray-600 mb-6">Visualização de clientes é restrita ao Caixa e Admin.</p>
                    <button onClick={() => router.push('/')} className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition">
                        Voltar para o Início
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
            {/* Sidebar for Desktop */}
            <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200">
                <div className="p-6">
                    <h1 className="text-2xl font-black text-red-600">Novo Paladar</h1>
                    <p className="text-xs text-gray-500 font-bold uppercase mt-1">
                        Logado como: <span className="text-red-600">{userName}</span> ({role})
                    </p>
                </div>

                <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
                    <NavLink href="/" icon={<Home size={20} />} label="Dashboard" pathname={pathname} />
                    <NavLink href="/mesas" icon={<Table2 size={20} />} label="Mesas" pathname={pathname} />
                    {isCaixa && <NavLink href="/caixa" icon={<Wallet size={20} />} label="Caixa Atual" pathname={pathname} />}
                    {isAdmin && <NavLink href="/produtos" icon={<Package size={20} />} label="Produtos" pathname={pathname} />}
                    {isCaixa && <NavLink href="/clientes" icon={<Users size={20} />} label="Clientes" pathname={pathname} />}
                    {isAdmin && <NavLink href="/relatorios" icon={<BarChart3 size={20} />} label="Relatórios" pathname={pathname} />}
                    {isAdmin && <NavLink href="/funcionarios" icon={<UserCog size={20} />} label="Funcionários" pathname={pathname} />}
                </nav>

                <div className="p-4 border-t border-gray-200 space-y-2">
                    {isAdmin && <NavLink href="/configuracoes" icon={<Settings size={20} />} label="Configurações" pathname={pathname} />}
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors font-bold"
                    >
                        <LogOut size={20} />
                        <span>Sair do Sistema</span>
                    </button>
                </div>
            </aside>

            {/* Bottom Nav for Mobile */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex overflow-x-auto hide-scrollbar z-50">
                <div className="flex w-max min-w-full justify-around px-2 py-1">
                    <MobileNavLink href="/" icon={<Home size={22} />} label="Home" active={pathname === '/'} />
                    <MobileNavLink href="/mesas" icon={<Table2 size={22} />} label="Mesas" active={pathname.startsWith('/mesas')} />
                    {isCaixa && <MobileNavLink href="/caixa" icon={<Wallet size={22} />} label="Caixa" active={pathname.startsWith('/caixa')} />}
                    {isAdmin && <MobileNavLink href="/produtos" icon={<Package size={22} />} label="Produtos" active={pathname.startsWith('/produtos')} />}
                    {isCaixa && <MobileNavLink href="/clientes" icon={<Users size={22} />} label="Clientes" active={pathname.startsWith('/clientes')} />}
                    {isAdmin && <MobileNavLink href="/relatorios" icon={<BarChart3 size={22} />} label="Relatos" active={pathname.startsWith('/relatorios')} />}
                    {isAdmin && <MobileNavLink href="/funcionarios" icon={<UserCog size={22} />} label="Equipe" active={pathname.startsWith('/funcionarios')} />}
                </div>
            </nav>

            {/* Main Content */}
            <main className="flex-1 pb-20 md:pb-0 h-screen overflow-hidden flex flex-col">
                <header className="md:hidden bg-white p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 z-40 shadow-sm">
                    <div>
                        <h1 className="text-xl font-black text-red-600 tracking-tight">Novo Paladar</h1>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">{userName} ({role})</p>
                    </div>
                    <button onClick={handleLogout} className="p-2 text-red-600 bg-red-50 rounded-full">
                        <LogOut size={20} />
                    </button>
                </header>
                <div className="flex-1 overflow-auto p-4 md:p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}

function NavLink({ href, icon, label, pathname }: { href: string; icon: ReactNode; label: string; pathname: string }) {
    const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));

    return (
        <Link
            href={href}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive
                ? 'bg-red-50 text-red-600 font-bold'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium'
                }`}
        >
            {icon}
            <span>{label}</span>
        </Link>
    );
}

function MobileNavLink({ href, icon, label, active }: { href: string; icon: ReactNode; label: string; active: boolean }) {
    return (
        <Link
            href={href}
            className={`flex flex-col items-center justify-center w-full py-1 gap-1 transition-colors ${active ? 'text-red-600' : 'text-gray-400 hover:text-gray-600'
                }`}
        >
            <div className={`${active ? 'bg-red-50 p-1.5 rounded-xl' : 'p-1.5'}`}>
                {icon}
            </div>
            <span className={`text-[9px] uppercase tracking-wider ${active ? 'font-black' : 'font-bold'}`}>{label}</span>
        </Link>
    );
}
