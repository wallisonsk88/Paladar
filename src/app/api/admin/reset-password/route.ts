import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usamos a SERVICE_ROLE_KEY que permite bypassar RLS e editar auth.users
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: Request) {
    if (!supabaseServiceKey) {
        return NextResponse.json(
            { error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.' },
            { status: 500 }
        );
    }

    try {
        const body = await request.json();
        const { targetUserId, newPassword, adminUserId } = body;

        if (!targetUserId || !newPassword || !adminUserId) {
            return NextResponse.json(
                { error: 'Dados insuficientes para troca de senha.' },
                { status: 400 }
            );
        }

        // 1. Instanciar o cliente Supabase de Admin (Service Role)
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // 2. Verificar se o usuário que está fazendo a requisição é realmente ADMIN
        const { data: adminEmployee, error: roleError } = await supabaseAdmin
            .from('employees')
            .select('role')
            .eq('id', adminUserId)
            .single();

        if (roleError || !adminEmployee || adminEmployee.role !== 'admin') {
            return NextResponse.json(
                { error: 'Acesso negado: Somente administradores podem alterar senhas.' },
                { status: 403 }
            );
        }

        // 3. Efetuar a troca de senha usando a API do Supabase Admin
        const { data, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            targetUserId,
            { password: newPassword }
        );

        if (updateError) {
            console.error('Erro ao atualizar senha no auth.admin:', updateError);
            return NextResponse.json(
                { error: updateError.message },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { success: true, message: 'Senha atualizada com sucesso!' },
            { status: 200 }
        );

    } catch (error: any) {
        console.error('Erro na rota de reset password:', error);
        return NextResponse.json(
            { error: 'Erro interno no servidor ao tentar trocar senha.' },
            { status: 500 }
        );
    }
}
