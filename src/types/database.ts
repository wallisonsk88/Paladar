export type TableStatus = 'Livre' | 'Ocupada' | 'Fechamento pendente';
export type PaymentMethod = 'Dinheiro' | 'Pix' | 'Cartão' | 'Fiado';
export type OrderStatus = 'Aberto' | 'Pago' | 'Cancelado';

export interface Product {
    id: string;
    name: string;
    price: number;
    active: boolean;
    created_at: string;
}

export interface Customer {
    id: string;
    name: string;
    phone?: string;
    credit_limit: number;
    total_debt: number;
    observations?: string;
    created_at: string;
}

export interface Table {
    id: string;
    number: number;
    status: TableStatus;
    customer_name?: string;
    opened_at?: string;
    created_at: string;
}

export interface Order {
    id: string;
    table_id: string;
    customer_id?: string;
    total_amount: number;
    status: OrderStatus;
    payment_method?: PaymentMethod;
    created_at: string;
    closed_at?: string;
}

export interface OrderItem {
    id: string;
    order_id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    observations?: string;
    created_at: string;
    product?: Product;
}

export interface Debt {
    id: string;
    customer_id: string;
    order_id: string;
    amount: number;
    status: 'Pendente' | 'Pago Parcial' | 'Pago Total';
    created_at: string;
}
