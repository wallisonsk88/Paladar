-- Create tables for Novo Paladar

-- 1. Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  credit_limit DECIMAL(10,2) DEFAULT 0.00,
  total_debt DECIMAL(10,2) DEFAULT 0.00,
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tables
CREATE TABLE tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number INTEGER UNIQUE NOT NULL,
  status TEXT DEFAULT 'Livre' CHECK (status IN ('Livre', 'Ocupada', 'Fechamento pendente')),
  customer_name TEXT,
  opened_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID REFERENCES tables(id),
  customer_id UUID REFERENCES customers(id), -- Optional
  total_amount DECIMAL(10,2) DEFAULT 0.00,
  status TEXT DEFAULT 'Aberto' CHECK (status IN ('Aberto', 'Pago', 'Cancelado')),
  payment_method TEXT CHECK (payment_method IN ('Dinheiro', 'Pix', 'Cartão', 'Fiado')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  closed_at TIMESTAMP WITH TIME ZONE
);

-- 5. Order Items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Debts (Fiado)
CREATE TABLE debts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id),
  order_id UUID REFERENCES orders(id),
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Pago Parcial', 'Pago Total')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id),
  customer_id UUID REFERENCES customers(id), -- For debt payments
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Realtime setup
ALTER PUBLICATION supabase_realtime ADD TABLE tables;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
