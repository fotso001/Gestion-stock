import express from 'express';
import { randomBytes } from 'crypto';
import mysql from 'mysql';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';

const app = express();

app.use(cors({
    origin: ['http://localhost:3000'],
    methods: ["POST", "GET"],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.json());

app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 1000 * 60 * 60 * 24
    }
}));

const db = mysql.createConnection({
    host: "localhost",
    user: 'root',
    password: "",
    database: 'myprojet'
});

app.get('/', (req, res) => {
    if (req.session.username) {
        return res.json({ valid: true, username: req.session.username });
    } else {
        return res.json({ valid: false });
    }
});

// Endpoint to get all clients
app.get('/client', (req, res) => {
    const sql = "SELECT * FROM client";
    db.query(sql, (err, result) => {
        if (err) return res.json({ Message: "Error retrieving clients" });
        return res.json(result);
    });
});

// Endpoint to get all products
app.get('/produit', (req, res) => {
    const sql = "SELECT * FROM produit";
    db.query(sql, (err, result) => {
        if (err) return res.json({ Message: "Error retrieving products" });
        return res.json(result);
    });
});


// Endpoint to get client by PHONE
app.get('/client/:id', (req, res) => {
    const { id } = req.params;
    const sql = "SELECT tel FROM client WHERE id_client = ?";
    
    db.query(sql, [id], (err, result) => {
        if (err) return res.json({ Message: "Error retrieving client name" });
        
        if (result.length > 0) {
            return res.json({ tel: result[0].tel });
        } else {
            return res.status(404).json({ Message: "Client not found" });
        }
    });
});




app.post('/commande', (req, res) => {
    const { id_client, produits, etat } = req.body;

    // Récupérer le téléphone du client
    const sqlGetClientInfo = "SELECT tel FROM client WHERE id_client = ?";
    db.query(sqlGetClientInfo, [id_client], (err, result) => {
        if (err) return res.json({ Message: "Error retrieving client info" });

        const clientInfo = result[0];
        if (!clientInfo) return res.status(404).json({ Message: "Client not found" });

        db.beginTransaction(err => {
            if (err) return res.json({ Message: "Error starting transaction" });

            const sqlInsertCommande = "INSERT INTO commande (id_client, etat) VALUES (?, ?)";
            db.query(sqlInsertCommande, [id_client, etat], (err, result) => {
                if (err) {
                    db.rollback();
                    return res.json({ Message: "Error inserting commande" });
                }

                const id_commande = result.insertId;
                const sqlInsertCommandeDetail = "INSERT INTO commande_detail (id_commande, codebar, quantite, prix, total) VALUES ?";
                const values = produits.map(produit => [id_commande, produit.codebar, produit.quantite, produit.prix, produit.total]);

                db.query(sqlInsertCommandeDetail, [values], (err, result) => {
                    if (err) {
                        db.rollback();
                        return res.json({ Message: "Error inserting commande details" });
                    }

                    const updateStockPromises = produits.map(produit => {
                        return new Promise((resolve, reject) => {
                            const sqlUpdateStock = "UPDATE produit SET quantite_stock = quantite_stock - ? WHERE codebar = ?";
                            db.query(sqlUpdateStock, [produit.quantite, produit.codebar], (err, result) => {
                                if (err) return reject(err);
                                resolve();
                            });
                        });
                    });

                    Promise.all(updateStockPromises)
                        .then(() => {
                            const checkStockPromises = produits.map(produit => {
                                return new Promise((resolve, reject) => {
                                    const sqlCheckStock = "SELECT quantite_stock, seuil FROM produit WHERE codebar = ?";
                                    db.query(sqlCheckStock, [produit.codebar], (err, result) => {
                                        if (err) return reject(err);
                                        const stock = result[0];
                                        if (stock.quantite_stock < stock.seuil) {
                                            // Enregistrer l'alerte ou envoyer une notification
                                            const sqlInsertAlert = "INSERT INTO alertes (codebar, message) VALUES (?, ?)";
                                            const message = `Le stock du produit avec le code-barres ${produit.codebar} est inférieur à son seuil.`;
                                            db.query(sqlInsertAlert, [produit.codebar, message], (err, result) => {
                                                if (err) return reject(err);
                                                resolve();
                                            });
                                        } else {
                                            resolve();
                                        }
                                    });
                                });
                            });

                            Promise.all(checkStockPromises)
                                .then(() => {
                                    db.commit(err => {
                                        if (err) {
                                            db.rollback();
                                            return res.json({ Message: "Error committing transaction" });
                                        }
                                        return res.json({ success: true, id_commande, tel: clientInfo.tel  });
                                    });
                                })
                                .catch(err => {
                                    db.rollback();
                                    return res.json({ Message: "Error checking stock levels" });
                                });
                        })
                        .catch(err => {
                            db.rollback();
                            return res.json({ Message: "Error updating stock" });
                        });
                });
            });
        });
    });
});



app.put('/commande/:id_commande', (req, res) => {
    const { id_commande } = req.params;
    const { etat } = req.body;

    const sqlUpdateEtat = "UPDATE commande SET etat = ? WHERE id_commande = ?";
    db.query(sqlUpdateEtat, [etat, id_commande], (err, result) => {
        if (err) return res.json({ Message: "Error updating commande status" });
        return res.json({ success: true });
    });
});


// Endpoint to add a new product
app.post('/produit', (req, res) => {
    const codebar = randomBytes(3).toString('hex'); // Génère un code-barres unique de 6 caractères
    const { name, prix, quantite_stock, seuil, id_fourni } = req.body;

    const sqlCheckProduct = "SELECT * FROM produit WHERE codebar = ?";
    db.query(sqlCheckProduct, [codebar], (err, results) => {
        if (err) return res.json({ Message: "Error in Node" });

        if (results.length > 0) {
            const sqlUpdateProduct = "UPDATE produit SET quantite_stock = quantite_stock + ?, prix = ?, seuil = ?, id_fourni = ?, date_modification = NOW() WHERE codebar = ?";
            const values = [quantite_stock, prix, seuil || 10, id_fourni, codebar];
            db.query(sqlUpdateProduct, values, (err, result) => {
                if (err) return res.json({ Message: "Error in Node" });
                return res.json(result);
            });
        } else {
            const sqlInsertProduct = "INSERT INTO produit (codebar, name, prix, quantite_stock, seuil, id_fourni, date_creation) VALUES (?, ?, ?, ?, ?, ?, NOW())";
            const values = [codebar, name, prix, quantite_stock, seuil || 10, id_fourni];
            db.query(sqlInsertProduct, values, (err, result) => {
                if (err) return res.json({ Message: "Error in Node" });
                return res.json(result);
            });
        }
    });
});

// Endpoint to update an existing product
app.put('/produit/:codebar', (req, res) => {
    const { codebar } = req.params;
    const { name, prix, quantite_stock, seuil, id_fourni } = req.body;

    const sqlUpdateProduct = "UPDATE produit SET name = ?, prix = ?, quantite_stock = quantite_stock + ?, seuil = ?, id_fourni = ?, date_modification = NOW() WHERE codebar = ?";
    const values = [name, prix, quantite_stock, seuil, id_fourni, codebar];
    db.query(sqlUpdateProduct, values, (err, result) => {
        if (err) return res.json({ Message: "Error in Node" });
        return res.json(result);
    });
});

app.post('/connexion', (req, res) => {
    const sql = "SELECT * FROM utilisateur WHERE email = ? and password = ?";
    db.query(sql, [req.body.email, req.body.password], (err, result) => {
        if (err) return res.json({ Message: "Error inside server" });
        if (result.length > 0) {
            req.session.username = result[0].username;
            return res.json({ Login: true, username: req.session.username });
        } else {
            return res.json({ Login: false });
        }
    });
});

app.listen(3001, () => {
    console.log("Connected to the server");
});
