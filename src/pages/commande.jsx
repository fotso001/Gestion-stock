import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function Commande() {
    const [clients, setClients] = useState([]);
    const [products, setProducts] = useState([]);
    const [selectedClient, setSelectedClient] = useState('');
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState(''); // Nouveau state pour le téléphone du client
    const [commande, setCommande] = useState([]);
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [quantities, setQuantities] = useState({});
    const [etat, setEtat] = useState('en_attente'); // Default to 'en_attente'
    const navigate = useNavigate();

    useEffect(() => {
        axios.get('http://localhost:3001/client')
            .then(res => setClients(res.data))
            .catch(err => console.log(err));

        axios.get('http://localhost:3001/produit')
            .then(res => setProducts(res.data))
            .catch(err => console.log(err));
    }, []);

    useEffect(() => {
        if (selectedClient) {
            axios.get(`http://localhost:3001/client/${selectedClient}`)
                .then(res => {
                    setClientName(res.data.name);
                    setClientPhone(res.data.telephone); // Récupérer le téléphone du client
                })
                .catch(err => console.log(err));
        }
    }, [selectedClient]);

    const handleQuantityChange = (codebar, quantity) => {
        setQuantities(prev => ({ ...prev, [codebar]: quantity }));
    };

    const handleAddProduct = () => {
        const newCommandeItems = selectedProducts.map(codebar => {
            const product = products.find(prod => prod.codebar === codebar);
            const quantite = quantities[codebar] || 1; // Default to 1 if no quantity specified
            return {
                codebar,
                quantite,
                prix: product.prix,
                name: product.name,
                total: product.prix * quantite
            };
        });

        setCommande(prev => [...prev, ...newCommandeItems]);
        setSelectedProducts([]);
        setQuantities({});
    };

    const handleSubmit = () => {
        const data = {
            id_client: selectedClient,
            produits: commande,
            etat: etat
        };

        axios.post('http://localhost:3001/commande', data)
            .then(res => {
                if (res.data.success) {
                    alert("Commande ajoutée avec succès");
                } else {
                    navigate('/commande');
                }
            })
            .catch(err => console.log(err));
    };

    const calculateTotal = () => {
        return commande.reduce((sum, prod) => sum + prod.total, 0).toFixed(2);
    };

    const handlePrint = () => {
        const printContent = `
            <html>
            <head>
                <title>Facture</title>
                <style>
                    body { font-family: Arial, sans-serif; }
                    .invoice { max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; }
                    .invoice-header { text-align: center; margin-bottom: 20px; }
                    .invoice-header h1 { margin: 0; }
                    .invoice-header p { margin: 0; }
                    .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    .invoice-table th, .invoice-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    .invoice-table th { background-color: #f4f4f4; }
                    .total-row { font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="invoice">
                    <div class="invoice-header">
                        <h1>Facture</h1>
                        <p><strong>Client:</strong> ${clientName}</p>
                        <p><strong>Téléphone:</strong> ${clientPhone}</p> <!-- Afficher le téléphone du client -->
                        <p><strong>État:</strong> ${etat}</p>
                    </div>
                    <table class="invoice-table">
                        <thead>
                            <tr>
                                <th>Code-barre</th>
                                <th>Nom</th>
                                <th>Prix</th>
                                <th>Quantité</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${commande.map(prod => `
                                <tr>
                                    <td>${prod.codebar}</td>
                                    <td>${prod.name}</td>
                                    <td>${prod.prix}</td>
                                    <td>${prod.quantite}</td>
                                    <td>${prod.total}</td>
                                </tr>
                            `).join('')}
                            <tr class="total-row">
                                <td colspan="4">Total</td>
                                <td>${calculateTotal()}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </body>
            </html>
        `;
        const printWindow = window.open('', '', 'height=600,width=800');
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };

    return (
        <div className="grid grid-cols-6 min-h-screen">
            <header className="bg-slate-800 text-white col-span-1 p-5">
                <div className="mb-10">
                    <h1 className="text-center text-3xl font-bold">GESTION DE STOCK</h1>
                </div>
                <nav>
                    <ul className="flex flex-col space-y-5 text-lg">
                        <li className="bg-blue-500 p-4 rounded-lg hover:bg-blue-700"><a href="home">ACCUEIL</a></li>
                        <li className="bg-blue-500 p-4 rounded-lg hover:bg-blue-700"><a href="client">CLIENTS</a></li>
                        <li className="bg-teal-500 p-4 rounded-lg hover:bg-teal-700"><a href="employe">EMPLOYÉS</a></li>
                        <li className="bg-purple-500 p-4 rounded-lg hover:bg-purple-700"><a href="fournisseur">FOURNISSEURS</a></li>
                        <li className="bg-green-500 p-4 rounded-lg hover:bg-green-700"><a href="produit">PRODUITS</a></li>
                        <li className="bg-green-500 p-4 rounded-lg hover:bg-green-700"><a href="listeprod">LISTE PRODUITS</a></li>
                        <li className="bg-cyan-500 p-4 rounded-lg hover:bg-cyan-700"><a href="commande">COMMANDES</a></li>
                    </ul>
                </nav>
            </header>
            <section className="col-span-5 bg-gray-100 p-10">
                <div className="text-center text-3xl font-bold mb-10">
                    <h1>Ajouter une Commande</h1>
                </div>
                <div className="bg-white p-10 rounded-lg shadow-lg">
                    <div className="mb-6">
                        <label className="block text-xl font-medium mb-2">Client:</label>
                        <select 
                            className="w-full p-2 border border-gray-300 rounded-lg"
                            onChange={(e) => setSelectedClient(e.target.value)} 
                            value={selectedClient}
                        >
                            <option value=''>Sélectionner un client</option>
                            {clients.map(client => (
                                <option key={client.id_client} value={client.id_client}>{client.name}</option>
                            ))}
                        </select>
                        <p className="mt-2">Nom du Client: {clientName}</p>
                        <p>Téléphone: {clientPhone}</p> {/* Afficher le téléphone du client */}
                    </div>
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold mb-4">Ajouter Produits</h2>
                        {products.map(product => (
                            <div key={product.codebar} className="mb-4">
                                <p className="text-lg font-medium">{product.name} - {product.prix} Frcfa</p>
                                <input 
                                    type="number"
                                    min="1"
                                    placeholder="Quantité"
                                    value={quantities[product.codebar] || ''}
                                    onChange={(e) => handleQuantityChange(product.codebar, e.target.value)}
                                    className="p-2 border border-gray-300 rounded-lg w-1/4"
                                />
                                <input 
                                    type="checkbox"
                                    value={product.codebar}
                                    checked={selectedProducts.includes(product.codebar)}
                                    onChange={(e) => {
                                        const codebar = e.target.value;
                                        setSelectedProducts(prev => 
                                            e.target.checked ? [...prev, codebar] : prev.filter(item => item !== codebar)
                                        );
                                    }}
                                    className="ml-2"
                                />
                            </div>
                        ))}
                        <button 
                            onClick={handleAddProduct}
                            className="bg-blue-500 text-white p-2 rounded-lg"
                        >
                            Ajouter Produits
                        </button>
                    </div>
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold mb-4">Commande</h2>
                        <label className="block text-lg font-medium mb-2">État de la Commande:</label>
                        <select 
                            className="w-full p-2 border border-gray-300 rounded-lg"
                            onChange={(e) => setEtat(e.target.value)} 
                            value={etat}
                        >
                            <option value="en_attente">En Attente</option>
                            <option value="non_livree">Non Livrée</option>
                            <option value="livree">Livrée</option>
                        </select>
                        <table className="w-full border-collapse mt-4">
                            <thead>
                                <tr>
                                    <th className="border p-2">Code-barre</th>
                                    <th className="border p-2">Nom</th>
                                    <th className="border p-2">Prix</th>
                                    <th className="border p-2">Quantité</th>
                                    <th className="border p-2">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {commande.map(prod => (
                                    <tr key={prod.codebar}>
                                        <td className="border p-2">{prod.codebar}</td>
                                        <td className="border p-2">{prod.name}</td>
                                        <td className="border p-2">{prod.prix}</td>
                                        <td className="border p-2">{prod.quantite}</td>
                                        <td className="border p-2">{prod.total}</td>
                                    </tr>
                                ))}
                                <tr className="font-bold">
                                    <td colSpan="4" className="border p-2">Total</td>
                                    <td className="border p-2">{calculateTotal()}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <button 
                        onClick={handleSubmit}
                        className="bg-green-500 text-white p-2 rounded-lg mr-4"
                    >
                        Sauvegarder Commande
                    </button>
                    <button 
                        onClick={handlePrint}
                        className="bg-blue-500 text-white p-2 rounded-lg"
                    >
                        Imprimer Facture
                    </button>
                </div>
            </section>
        </div>
    );
}

export default Commande;
