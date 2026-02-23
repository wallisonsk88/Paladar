-- Create cash_registers table
CREATE TABLE IF NOT EXISTS cash_registers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opened_by UUID REFERENCES auth.users(id) NOT NULL,
  closed_by UUID REFERENCES auth.users(id),
  opened_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  closed_at TIMESTAMPTZ,
  initial_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  final_balance DECIMAL(12,2),
  status TEXT DEFAULT 'Aberto' CHECK (status IN ('Aberto', 'Fechado')),
  notes TEXT
);

-- Enable RLS for cash_registers
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access
CREATE POLICY "Enable read access for cash_registers" ON cash_registers FOR SELECT USING (true);

-- Create policy to allow insert access
CREATE POLICY "Enable insert access for cash_registers" ON cash_registers FOR INSERT WITH CHECK (true);

-- Create policy to allow update access
CREATE POLICY "Enable update access for cash_registers" ON cash_registers FOR UPDATE USING (true);


-- Create cash_transactions table (Sangrias e Suprimentos)
CREATE TABLE IF NOT EXISTS cash_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cash_register_id UUID REFERENCES cash_registers(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Sangria', 'Suprimento', 'Venda')),
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for cash_transactions
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access
CREATE POLICY "Enable read access for cash_transactions" ON cash_transactions FOR SELECT USING (true);

-- Create policy to allow insert access
CREATE POLICY "Enable insert access for cash_transactions" ON cash_transactions FOR INSERT WITH CHECK (true);

-- Create policy to allow update access
CREATE POLICY "Enable update access for cash_transactions" ON cash_transactions FOR UPDATE USING (true);
