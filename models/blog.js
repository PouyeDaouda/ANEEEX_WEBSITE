const mongoose = require('mongoose');

const blogArticleSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        minlength: [3, 'Le titre doit contenir au moins 3 caractères.'],
        maxlength: [100, 'Le titre ne peut pas dépasser 100 caractères.']
    },
    description: {
        type: String,
        required: true,
        trim: true,
        minlength: [10, 'La description doit contenir au moins 10 caractères.'],
        maxlength: [5000, 'La description ne peut pas dépasser 5000 caractères.'] // Ajustez selon vos besoins
    },
    mediaType: {
        type: String,
        enum: ['image'], // Seul 'image' est autorisé
        required: true
    },
    mediaUrl: {
        type: String,
        required: true,
        trim: true
    },
    cloudinaryPublicId: { // Ajout pour stocker l'ID public de Cloudinary
        type: String,
        required: false // Sera requis si mediaUrl est une URL Cloudinary
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Formatage de la date
blogArticleSchema.virtual('formattedDate').get(function() {
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    return this.createdAt.toLocaleDateString('fr-FR', options);
});

module.exports = mongoose.model('BlogArticle', blogArticleSchema);