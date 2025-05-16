require('dotenv').config();
const express = require("express");
const https = require('https');
const bodyParser = require("body-parser");
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo'); // Ajout de connect-mongo
const bcrypt = require('bcryptjs'); // Décommenté et utilisé
const path = require('path');
const multer = require('multer'); // Ajout de multer
const fs = require('fs'); // Ajout de fs pour la gestion de fichiers (création de dossier, suppression)
const helmet = require('helmet'); // Ajout de helmet pour la sécurité
const rateLimit = require('express-rate-limit'); // Ajout pour la limitation des tentatives
const Tokens = require('csrf');
const tokens = new Tokens(); // Ajout pour la protection CSRF
const winston = require('winston'); // Ajout pour la journalisation
const sanitizeHtml = require('sanitize-html'); // Ajout pour l'assainissement HTML
const compression = require('compression');
const spdy = require('spdy');
const cloudinary = require('cloudinary').v2; // SDK Cloudinary
const { CloudinaryStorage } = require('multer-storage-cloudinary'); // Stockage Cloudinary pour Multer
const { SitemapStream, streamToPromise } = require('sitemap');
const { Readable } = require('stream');

// Modèles MongoDB
const BlogArticle = require('./models/blog');
const Admin = require('./models/admin');
const blogRoutes = require('./routes/blogRoutes'); // Importer les routes du blog

// Initialisation Express
const app = express();
app.use(compression())
// Configuration de Winston pour la journalisation
const logger = winston.createLogger({
    level: 'info', // Niveau minimum à logguer
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(), // Logguer aussi dans la console
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }), // Logguer les erreurs dans un fichier
        new winston.transports.File({ filename: 'logs/combined.log' }) // Logguer tout (info et plus) dans un autre fichier
    ],
});
// Créer le dossier logs s'il n'existe pas
if (!fs.existsSync('logs')) { fs.mkdirSync('logs'); }

// Configuration de Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true // Utiliser HTTPS pour les URLs
});
// Middlewares de sécurité
// Utiliser helmet pour divers en-têtes de sécurité
app.use(
    helmet.contentSecurityPolicy({
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'"],
            "script-src-attr": ["'unsafe-inline'"], // Ajouter cette ligne pour autoriser les attributs de script en ligne
            "style-src": [
                "'self'",
                "*.cloudinary.com", // Ajout pour les images Cloudinary
                "https://fonts.googleapis.com",
                "https://cdnjs.cloudflare.com",
                "'sha256-aqNNdDLnnrDOnTNdkJpYlAxKVJtLt9CtFLklmInuUAE='",
                "'sha256-L1J2KnMqBWO2+V5AI8PIPCQZWQw7InRoGC0BZXx3bCk='"
            ],
            "font-src": [
                "'self'",
                "https://fonts.gstatic.com",
                "https://cdnjs.cloudflare.com"
            ],
            "img-src": [ // Ajouter ou modifier la directive img-src
                "'self'",
                "data:",
                "res.cloudinary.com" // Autoriser les images depuis Cloudinary
            ],
        },
    })
);


// Limiteur de tentatives pour la connexion admin
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limiter chaque IP à 5 tentatives de connexion par fenêtre
    message: 'Trop de tentatives de connexion depuis cette IP, veuillez réessayer après 15 minutes.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
// app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Plus nécessaire si tout est sur Cloudinary

// Création du dossier uploads s'il n'existe pas
// const uploadsDir = path.join(__dirname, 'uploads'); // Plus nécessaire
// if (!fs.existsSync(uploadsDir)) {
//     fs.mkdirSync(uploadsDir, { recursive: true });
// }

// Configuration du store de session MongoDB
const sessionStore = MongoStore.create({
    mongoUrl: process.env.MDB_URI, // Utilise l'URI de votre base de données MongoDB
    collectionName: 'sessions', // Nom de la collection où les sessions seront stockées
    ttl: 14 * 24 * 60 * 60 // Temps de vie de la session en secondes (ex: 14 jours)
});

app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-super-secret-key-please-change', // Assurez-vous que SESSION_SECRET est défini et fort
    name: 'sessionId', // Nom générique pour le cookie de session
    resave: false,
    saveUninitialized: false, // Ne pas sauvegarder les sessions non modifiées
    store: sessionStore, // Utiliser MongoStore pour stocker les sessions
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Mettre à true si vous utilisez HTTPS en production
        httpOnly: true, // Empêche l'accès au cookie via JavaScript côté client (bonne pratique)
        maxAge: 1000 * 60 * 60 * 24 * 14, // Durée de vie du cookie (14 jours), correspond au TTL du store
        sameSite: 'lax' // Protection contre les attaques CSRF
    }
}));

// Middleware CSRF (après session)
// Modifié pour stocker le secret CSRF dans la session, ce qui est plus simple avec express-session
const csrfProtection = (req, res, next) => {
    // Générer un token si la session n'en a pas
    if (!req.session.csrfSecret) {
        req.session.csrfSecret = tokens.secretSync();
    }

    // Ajouter la fonction csrfToken à l'objet req
    req.csrfToken = function () {
        return tokens.create(req.session.csrfSecret);
    };

    // Pour les requêtes POST, PUT, DELETE, vérifier le token
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        // Récupérer le token depuis le corps de la requête ou les en-têtes
        // Vérifier si req.body existe avant d'y accéder
        const token = (req.body && req.body._csrf) ||
            req.headers['x-csrf-token'] ||
            req.headers['x-xsrf-token'];

        if (!token || !tokens.verify(req.session.csrfSecret, token)) {
            return res.status(403).send('Invalid CSRF token');
        }
    }

    next();
};

// app.use(csrfProtection); // Supprimé pour une application plus ciblée

// Configuration de Multer pour le téléversement d'images vers Cloudinary
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'aneeex_blog_images', // Nom du dossier sur Cloudinary
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        // transformation: [{ width: 800, height: 600, crop: 'limit' }] // Optionnel: transformer les images à l'upload
        public_id: (req, file) => Date.now() + '-' + file.originalname.replace(/\s+/g, '_').split('.')[0] // Nom de fichier unique
    },
});


const imageFileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Seuls les fichiers image sont autorisés!'), false);
    }
};

const upload = multer({ storage: storage, fileFilter: imageFileFilter });

// Configuration des vues
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

// Fonction pour créer un utilisateur admin par défaut si aucun n'existe
async function ensureAdminUser() {
    try {
        const adminCount = await Admin.countDocuments();
        if (adminCount === 0) {
            const defaultAdminUsername = process.env.ADMIN_USERNAME || 'admin';
            const defaultAdminPassword = process.env.ADMIN_PASSWORD;

            if (!defaultAdminPassword || !defaultAdminUsername) {
                console.error("ADMIN_USERNAME et/ou ADMIN_PASSWORD ne sont pas définis dans .env. Impossible de créer l'utilisateur admin par défaut.");
                process.exit(1); // Quitter si la configuration essentielle est manquante
            }

            const admin = new Admin({ username: defaultAdminUsername, password: defaultAdminPassword });
            await admin.save(); // Le middleware pre-save hache le mot de passe
            logger.info(`Utilisateur admin par défaut "${defaultAdminUsername}" créé.`);
        }
    } catch (error) {
        logger.error("Erreur lors de la vérification/création de l'utilisateur admin:", error);
        // Ne pas quitter, l'application peut peut-être fonctionner sans admin par défaut si un existe déjà
    }
}

// Connexion MongoDB
mongoose.connect(process.env.MDB_URI)
    .then(() => {
        console.log("MongoDB connected successfully");
        ensureAdminUser(); // S'assurer que l'utilisateur admin existe après la connexion à la BDD (asynchrone)
    })
    .catch(err => { logger.error("MongoDB connection error:", err); process.exit(1); });
// Middleware d'authentification
const authenticateAdmin = (req, res, next) => { // Ce middleware ne nécessite pas CSRF car il ne modifie pas l'état
    if (req.session.adminLoggedIn) {
        return next();
    }
    res.redirect('/admin/login');
};

app.get('/sitemap.xml', async (req, res) => {
    try {
        const hostname = `https://${req.headers.host}`;
        const links = [
            { url: '/', changefreq: 'daily', priority: 1.0, lastmod: new Date() },
            { url: '/blog', changefreq: 'daily', priority: 0.8, lastmod: new Date() },
            { url: '/a-propos', changefreq: 'monthly', priority: 0.7, lastmod: new Date() },
            // Ajoutez d'autres pages statiques ici
        ];

        const articles = await BlogArticle.find().select('_id createdAt').sort({ createdAt: -1 });
        articles.forEach(article => {
            links.push({
                // Important: Ce lien doit pointer vers la page HTML complète de l'article (voir point 6)
                url: `/blog/article/${article._id}/view`, // Assurez-vous que cette URL existe et sert du HTML
                changefreq: 'weekly',
                lastmod: article.createdAt,
                priority: 0.9
            });
        });

        const stream = new SitemapStream({ hostname });
        res.header('Content-Type', 'application/xml');

        const xmlStream = Readable.from(links).pipe(stream);
        const sitemap = await streamToPromise(xmlStream);
        res.send(sitemap.toString());

    } catch (error) {
        logger.error('Error generating sitemap:', error);
        res.status(500).send('Error generating sitemap');
    }
});

// Routes publiques
app.get('/', (req, res) => {
    const canonicalUrl = `https://${req.headers.host}${req.originalUrl}`;
    res.render('home', {
        title: 'Accueil', // Assurez-vous que le titre est bien défini
        pageDescription: "ANEEEX - L'Association Nationale des Élèves & Étudiants pour l'Excellence s'engage à promouvoir les valeurs éthiques et à soutenir le développement académique et personnel des jeunes au Sénégal.",
        ogTitle: 'ANEEEX - Excellence de la Jeunesse Sénégalaise',
        ogDescription: "ANEEEX s'engage à promouvoir les valeurs éthiques et à soutenir le développement académique et personnel des jeunes au Sénégal.",
        ogUrl: canonicalUrl,
        ogType: 'website'
    });
});

// Utiliser les routes du blog pour toutes les requêtes commençant par /blog
app.use('/blog', blogRoutes);
app.get('/a-propos', (req, res) => {
    const canonicalUrl = `https://${req.headers.host}${req.originalUrl}`;
    res.render('apropos', {
        title: 'À Propos de l\'ANEEEX', // Titre plus spécifique
        pageDescription: "Découvrez l'histoire, la mission et la vision de l'ANEEEX, l'Association Nationale des Élèves & Étudiants pour l'Excellence au Sénégal.",
        ogTitle: 'À Propos de l\'ANEEEX',
        ogDescription: "Découvrez l'histoire, la mission et la vision de l'ANEEEX, l'Association Nationale des Élèves & Étudiants pour l'Excellence au Sénégal.",
        ogUrl: canonicalUrl,
        ogType: 'article' // ou 'website' si plus approprié
    });
});

// Routes admin
// Routes admin
// Appliquer csrfProtection pour que req.csrfToken() soit disponible
app.get('/admin/login', csrfProtection, (req, res) => {
    res.render('admin/login', {
        title: 'Connexion',
        showHeader: false,
        csrfToken: req.csrfToken(), // Passer le token CSRF à la vue
        error: null, // S'assurer que 'error' est défini même s'il n'y en a pas
        username: '' // Pour pré-remplir en cas d'erreur
    });
});

// Appliquer csrfProtection pour que req.csrfToken() soit disponible
app.get('/admin/dashboard', authenticateAdmin, csrfProtection, async (req, res) => {
    try {
        const articles = await BlogArticle.find().sort({ createdAt: -1 });
        res.render('admin/dashboard', {
            title: 'Tableau de bord',
            articles,
            csrfToken: req.csrfToken() // Passer le token CSRF
        });
    } catch (err) {
        logger.error("Erreur lors du chargement du tableau de bord:", err);
        res.status(500).send('Server Error');
    }
});

// Appliquer CSRF et loginLimiter sur la route POST de login
// bodyParser peuple req.body, donc csrfProtection peut s'exécuter avant le handler.
app.post('/admin/login', loginLimiter, csrfProtection, async (req, res) => {
    const { username, password } = req.body;

    try {
        const admin = await Admin.findOne({ username });
        if (!admin) {
            return res.render('admin/login', {
                error: 'Nom d\'utilisateur ou mot de passe incorrect.',
                csrfToken: req.csrfToken(), // Repasser le token en cas d'erreur
                showHeader: false,
                username: username // Renvoyer le nom d'utilisateur pour pré-remplir
            });
        }

        const isMatch = await admin.comparePassword(password);
        if (isMatch) {
            req.session.adminLoggedIn = true;
            req.session.adminUsername = admin.username; // Optionnel: stocker le nom d'utilisateur dans la session
            logger.info(`Connexion admin réussie pour l'utilisateur: ${username}`);
            res.redirect('/admin/dashboard');
        } else {
            logger.warn(`Tentative de connexion admin échouée pour l'utilisateur: ${username}`);
            res.render('admin/login', {
                error: 'Nom d\'utilisateur ou mot de passe incorrect.',
                csrfToken: req.csrfToken(), // Repasser le token en cas d'erreur
                showHeader: false,
                username: username
            });
        }
    } catch (err) {
        logger.error("Erreur serveur lors de la connexion admin:", err);
        res.status(500).render('admin/login', { // Renvoyer vers la page de login avec une erreur serveur
            error: 'Erreur serveur lors de la connexion.',
            showHeader: false,
            username: username
        });
    }
});

// CRUD Operations
// Ordre important : authenticateAdmin, puis upload (qui peuple req.body pour multipart), PUIS csrfProtection
app.post('/admin/articles', authenticateAdmin, upload.single('mediaFile'), csrfProtection, async (req, res) => {
    try {
        const { title, description } = req.body; // mediaType et mediaUrlInput supprimés

        const sanitizedDescription = sanitizeHtml(description); // Assainir la description

        if (!req.file) {
            // Si req.file n'existe pas, cela signifie que multer-storage-cloudinary n'a pas pu uploader
            // ou que le filtre a rejeté le fichier.
            // Multer-storage-cloudinary gère les erreurs d'upload, donc si on arrive ici sans req.file,
            // c'est probablement que le champ 'mediaFile' était vide.
            return res.status(400).json({ message: 'Aucun fichier image fourni ou type de fichier invalide.' });
        }

        const newArticle = new BlogArticle({
            title,
            description: sanitizedDescription, // Utiliser la description assainie
            mediaType: 'image', // Toujours 'image'
            mediaUrl: req.file.path, // URL sécurisée fournie par Cloudinary
            cloudinaryPublicId: req.file.filename // Nom de fichier (public_id) fourni par Cloudinary
        });
        await newArticle.save();
        res.status(201).json({ message: "Article créé avec succès.", article: newArticle });
    } catch (err) {
        logger.error("Erreur lors de la création de l'article:", err);
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ message: `Erreur Multer: ${err.message}` });
        }
        // L'erreur 'Seuls les fichiers image sont autorisés!' est gérée par le imageFileFilter de Multer
        // et multer-storage-cloudinary peut aussi retourner des erreurs spécifiques.
        // Si une erreur Cloudinary survient pendant l'upload par multer-storage-cloudinary, elle sera souvent encapsulée.
        if (err.message && (err.message.includes('Cloudinary') || err.message.includes('Invalid file type'))) {
            return res.status(400).json({ message: err.message });
        }
        // Gérer les erreurs de validation Mongoose
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: 'Erreur serveur lors de la création.' });
    }
});

// Pour les requêtes non-multipart où le token est dans un header ou query, csrfProtection peut être avant.
app.post('/admin/articles/:id/delete', authenticateAdmin, csrfProtection, async (req, res) => {
    try {
        const article = await BlogArticle.findById(req.params.id);
        if (!article) {
            return res.status(404).json({ message: "Article non trouvé." });
        }

        // Supprimer l'image de Cloudinary
        if (article.cloudinaryPublicId) {
            try {
                await cloudinary.uploader.destroy(article.cloudinaryPublicId);
            } catch (cloudinaryErr) {
                logger.error(`Erreur lors de la suppression de l'image ${article.cloudinaryPublicId} de Cloudinary:`, cloudinaryErr);
                // Continuer même si la suppression de Cloudinary échoue, pour supprimer l'article de la BDD
            }
        }
        await BlogArticle.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Article supprimé avec succès." });
    } catch (err) {
        logger.error(`Erreur lors de la suppression de l'article ${req.params.id}:`, err);
        if (err.name === 'CastError') {
            return res.status(400).json({ message: "ID d'article invalide." });
        }
        res.status(500).json({ message: 'Erreur serveur lors de la suppression.' });
    }
});

// Route pour la modification d'article
// Ordre important : authenticateAdmin, puis upload, PUIS csrfProtection
app.put('/admin/articles/:id', authenticateAdmin, upload.single('mediaFile'), csrfProtection, async (req, res) => {
    try {
        const { title, description } = req.body;
        const articleId = req.params.id;

        const articleToUpdate = await BlogArticle.findById(articleId);
        if (!articleToUpdate) {
            return res.status(404).json({ message: "Article non trouvé." });
        }

        articleToUpdate.title = title;
        articleToUpdate.description = sanitizeHtml(description); // Assainir la description lors de la mise à jour

        // Si un nouveau fichier est téléversé
        if (req.file) {
            // Supprimer l'ancienne image de Cloudinary si elle existe
            if (articleToUpdate.cloudinaryPublicId) {
                try {
                    await cloudinary.uploader.destroy(articleToUpdate.cloudinaryPublicId);
                } catch (cloudinaryErr) {
                    logger.error(`Erreur lors de la suppression de l'ancienne image ${articleToUpdate.cloudinaryPublicId} de Cloudinary:`, cloudinaryErr);
                    // Ne pas bloquer la mise à jour si la suppression de l'ancienne image échoue
                }
            }
            // Mettre à jour avec la nouvelle image
            articleToUpdate.mediaUrl = req.file.path; // Nouvelle URL de Cloudinary
            articleToUpdate.cloudinaryPublicId = req.file.filename; // Nouveau public_id de Cloudinary
        }

        await articleToUpdate.save();
        res.status(200).json({ message: "Article mis à jour avec succès.", article: articleToUpdate });
    } catch (err) {
        logger.error(`Erreur lors de la mise à jour de l'article ${req.params.id}:`, err);
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ message: `Erreur Multer: ${err.message}` });
        }
        if (err.message && (err.message.includes('Cloudinary') || err.message.includes('Invalid file type'))) {
            return res.status(400).json({ message: err.message });
        } else if (err.name === 'CastError') {
            return res.status(400).json({ message: "ID d'article invalide." });
        } else if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour.' });
    }
});


app.get('/admin/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) { // Logguer l'erreur de destruction de session
            console.error("Erreur lors de la déconnexion:", err);
            return res.status(500).send("Erreur lors de la déconnexion");
        }
        res.redirect('/admin/login');
    });
});

// Démarrer le serveur
const PORT = process.env.PORT || 3000; // Utiliser le port fourni par l'environnement ou 3000 par défaut

// Démarrer un serveur HTTP standard (l'hébergeur gère HTTPS)
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});