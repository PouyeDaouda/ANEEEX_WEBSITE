// c:\Users\pouye\Desktop\ANEEEX2\public\scripts\blog.js
document.addEventListener('DOMContentLoaded', () => {
    const readMoreLinks = document.querySelectorAll('a.read-more[data-article-id]');
    const fullArticleOverlay = document.getElementById('full-article-overlay');
    const fullArticleContainer = document.getElementById('full-article-container');
    
    if (!fullArticleOverlay || !fullArticleContainer) {
        console.error('Les éléments DOM pour l\'affichage de l\'article complet sont introuvables.');
        return;
    }

    const closeBtn = fullArticleContainer.querySelector('.close-btn');
    const titleEl = document.getElementById('full-article-title');
    const dateEl = document.getElementById('full-article-date');
    const mediaContainerEl = document.getElementById('full-article-media-container');
    const descriptionEl = document.getElementById('full-article-description');

    if (!closeBtn || !titleEl || !dateEl || !mediaContainerEl || !descriptionEl) {
        console.error('Un ou plusieurs éléments enfants du conteneur d\'article sont introuvables.');
        return;
    }

    readMoreLinks.forEach(link => {
        link.addEventListener('click', async (event) => {
            event.preventDefault();
            const articleId = link.dataset.articleId;
            if (!articleId) return;

            // Afficher un état de chargement simple
            titleEl.textContent = 'Chargement...';
            dateEl.textContent = '';
            mediaContainerEl.innerHTML = '';
            descriptionEl.innerHTML = ''; // Utiliser innerHTML pour la description
            fullArticleOverlay.style.display = 'block';
            document.body.style.overflow = 'hidden'; // Empêcher le défilement de la page derrière

            try {
                const response = await fetch(`/blog/article/${articleId}`);
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: `Erreur HTTP ${response.status}` }));
                    throw new Error(errorData.message || `Erreur ${response.status}`);
                }
                const article = await response.json();

                titleEl.textContent = article.title;
                dateEl.textContent = article.formattedDate ? `Publié le ${article.formattedDate}` : '';

                mediaContainerEl.innerHTML = ''; // Vider l'ancien média
                if (article.mediaType === 'image' && article.mediaUrl) {
                    const img = document.createElement('img');
                    img.src = article.mediaUrl;
                    img.alt = article.title;
                    mediaContainerEl.appendChild(img);
                } // La logique pour 'video' est supprimée
                
                // Utiliser textContent pour afficher la description comme texte brut et prévenir les attaques XSS
                descriptionEl.textContent = article.description;

            } catch (error) {
                console.error('Erreur lors du chargement de l\'article:', error);
                titleEl.textContent = 'Erreur de chargement';
                descriptionEl.innerHTML = `Impossible de charger l'article. ${error.message}`;
            }
        });
    });

    function closeArticleOverlay() {
        fullArticleOverlay.style.display = 'none';
        document.body.style.overflow = ''; // Rétablir le défilement
        
        // La logique pour arrêter les iframes vidéo est supprimée
    }

    closeBtn.addEventListener('click', closeArticleOverlay);

    // Fermer en cliquant en dehors du contenu de l'article
    fullArticleOverlay.addEventListener('click', (event) => {
        if (event.target === fullArticleOverlay) { 
            closeArticleOverlay();
        }
    });
    
    // Fermer avec la touche Échap
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && fullArticleOverlay.style.display === 'block') {
            closeArticleOverlay();
        }
    });
});
