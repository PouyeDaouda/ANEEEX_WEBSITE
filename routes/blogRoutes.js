// c:\Users\pouye\Desktop\ANEEEX2\routes\blogRoutes.js
const express = require('express');
const router = express.Router();
const BlogArticle = require('../models/blog'); // Ajustez le chemin si nécessaire
const { formatDate } = require('../utils/dateFormatter'); // Chemin corrigé pour remonter d'un niveau
const sanitizeHtml = require('sanitize-html'); // Importer sanitize-html

// Route pour la page principale du blog
router.get('/', async (req, res) => {
    try {
        const articles = await BlogArticle.find().sort({ createdAt: -1 });
        const articlesWithFormattedDate = articles.map(article => ({
            ...article.toObject(),
            formattedDate: formatDate(article.createdAt),
            // Préparer l'extrait de description ici
            shortDescription: sanitizeHtml(article.description, { allowedTags: [], allowedAttributes: {} }).substring(0, 150) +
                              (article.description.length > 150 ? '...' : '')

        }));
        const canonicalUrl = `https://${req.headers.host}${req.originalUrl}`;
        res.render('blog', {
            title: 'Blog ANEEEX',
            articles: articlesWithFormattedDate,
            pageDescription: "Explorez les articles, actualités et conseils de l'ANEEEX sur l'éducation, l'excellence académique et le développement des jeunes au Sénégal.",
            ogTitle: 'Blog ANEEEX - Actualités et Conseils',
            ogDescription: "Explorez les articles et actualités de l'ANEEEX pour l'excellence des jeunes.",
            ogUrl: canonicalUrl
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Erreur lors du chargement des articles du blog.");
    }
});

// MODIFICATION: Retourner les données de l'article en JSON
router.get('/article/:id', async (req, res) => {
    try {
        const article = await BlogArticle.findById(req.params.id);
        if (!article) {
            return res.status(404).json({ message: 'Article non trouvé' });
        }
        // Renvoyer l'article en format JSON avec la date formatée
        const articleData = {
            ...article.toObject(),
            formattedDate: formatDate(article.createdAt)
        };
        res.json(articleData);
    } catch (error) {
        console.error(error);
        // Si l'ID n'est pas un ObjectId valide, Mongoose lèvera une erreur CastError
        if (error.name === 'CastError') {
            return res.status(404).json({ message: 'ID d\'article invalide' });
        }
        res.status(500).json({ message: "Erreur lors du chargement de l'article." });
    }
});

module.exports = router;
