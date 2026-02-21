'use client';

import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, Button, CardHeader, CardTitle } from '@/components/ui/Card';
import { Product } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Search, CheckCircle2, XCircle } from 'lucide-react';

export default function ProdutosPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [formData, setFormData] = useState({ name: '', price: '' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchProducts();
    }, []);

    async function fetchProducts() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('name', { ascending: true });

            if (error) {
                console.error('Error fetching products:', error);
            } else {
                setProducts(data || []);
            }
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveProduct(e: React.FormEvent) {
        e.preventDefault();
        try {
            setSaving(true);
            const price = parseFloat(formData.price.replace(',', '.'));

            if (editingProduct) {
                const { error } = await supabase
                    .from('products')
                    .update({ name: formData.name, price })
                    .eq('id', editingProduct.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('products')
                    .insert([{ name: formData.name, price, active: true }]);
                if (error) throw error;
            }

            setIsModalOpen(false);
            setFormData({ name: '', price: '' });
            setEditingProduct(null);
            fetchProducts();
        } catch (error) {
            console.error('Error saving product:', error);
            alert('Erro ao salvar produto.');
        } finally {
            setSaving(false);
        }
    }

    async function toggleProductStatus(product: Product) {
        try {
            const { error } = await supabase
                .from('products')
                .update({ active: !product.active })
                .eq('id', product.id);
            if (error) throw error;
            fetchProducts();
        } catch (error) {
            console.error('Error toggling status:', error);
        }
    }

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AppLayout>
            <div className="max-w-7xl mx-auto">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900">Produtos</h2>
                        <p className="text-gray-500">Cadastre e gerencie o cardápio do seu estabelecimento.</p>
                    </div>
                    <Button onClick={() => {
                        setEditingProduct(null);
                        setFormData({ name: '', price: '' });
                        setIsModalOpen(true);
                    }}>
                        <Plus size={20} />
                        Novo Produto
                    </Button>
                </header>

                <Card className="mb-8">
                    <CardContent className="py-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Buscar produto pelo nome..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        <p className="col-span-full text-center py-12 text-gray-500">Carregando produtos...</p>
                    ) : filteredProducts.length === 0 ? (
                        <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                            <p className="text-gray-500">Nenhum produto encontrado.</p>
                        </div>
                    ) : (
                        filteredProducts.map((product) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                onEdit={() => {
                                    setEditingProduct(product);
                                    setFormData({ name: product.name, price: product.price.toString() });
                                    setIsModalOpen(true);
                                }}
                                onToggle={() => toggleProductStatus(product)}
                            />
                        ))
                    )}
                </div>

                {/* Modal Novo/Editar Produto */}
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <Card className="w-full max-w-md animate-in zoom-in-95 duration-200">
                            <CardHeader>
                                <CardTitle>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</CardTitle>
                            </CardHeader>
                            <form onSubmit={handleSaveProduct}>
                                <CardContent className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Nome do Produto</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                                            placeholder="Ex: Coca-Cola 350ml"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Preço (R$)</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                                            placeholder="0,00"
                                            value={formData.price}
                                            onChange={e => setFormData({ ...formData, price: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex gap-3 pt-4">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            className="flex-1"
                                            onClick={() => setIsModalOpen(false)}
                                            disabled={saving}
                                        >
                                            Cancelar
                                        </Button>
                                        <Button
                                            type="submit"
                                            className="flex-1"
                                            disabled={saving}
                                        >
                                            {saving ? 'Salvando...' : 'Salvar'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </form>
                        </Card>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function ProductCard({ product, onEdit, onToggle }: { product: Product, onEdit: () => void, onToggle: () => void }) {
    return (
        <Card className={!product.active ? 'opacity-60 bg-gray-50' : ''}>
            <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h4 className="text-xl font-bold text-gray-900">{product.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-2xl font-black text-red-600">
                                R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                            {!product.active && (
                                <span className="bg-gray-200 text-gray-600 text-[10px] uppercase font-bold px-2 py-0.5 rounded">
                                    Inativo
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-1">
                        <Button variant="ghost" className="p-2 h-auto" title="Editar" onClick={onEdit}>
                            <Edit2 size={18} />
                        </Button>
                        <Button
                            variant="ghost"
                            className={`p-2 h-auto ${product.active ? 'text-red-500' : 'text-green-500'}`}
                            title={product.active ? 'Desativar' : 'Ativar'}
                            onClick={onToggle}
                        >
                            {product.active ? <Trash2 size={18} /> : <CheckCircle2 size={18} />}
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                    {product.active ? (
                        <span className="flex items-center gap-1 text-green-600 font-medium">
                            <CheckCircle2 size={16} />
                            Disponível
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-gray-500 font-medium">
                            <XCircle size={16} />
                            Indisponível
                        </span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
