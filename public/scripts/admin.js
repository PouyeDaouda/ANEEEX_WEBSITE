document.addEventListener('DOMContentLoaded', function() {
    // Éléments du DOM
    const addArticleBtn = document.getElementById('addArticleBtn');
    const modal = document.getElementById('articleModal');
    const closeModalBtn = document.querySelector('.close-modal');
    const articleForm = document.getElementById('articleForm');
    const csrfToken = document.querySelector('input[name="_csrf"]')?.value; // Récupérer le token CSRF
    const modalTitle = document.getElementById('modalTitle');
    const articleIdInput = document.getElementById('articleId');

    // Champs du formulaire dans le modal
    const titleModalInput = document.getElementById('titleModalInput');
    const descriptionModalInput = document.getElementById('descriptionModalInput');
    // const mediaTypeRadiosModal = document.querySelectorAll('input[name="mediaType"]'); // Supprimé
    const mediaFileInputGroupModal = document.getElementById('mediaFileInputGroupModal');
    // const mediaUrlInputGroupModal = document.getElementById('mediaUrlInputGroupModal'); // Supprimé
    const mediaFileModalInput = document.getElementById('mediaFileModal');
    // const mediaUrlModalInput = document.getElementById('mediaUrlInputModal'); // Supprimé

    // Boutons de suppression (inchangé)
    const deleteButtons = document.querySelectorAll('.delete-btn');

    function toggleMediaInputFieldsModal() {
        const isEditing = !!articleIdInput.value; // True if articleId has a value
        const selectedType = document.querySelector('input[name="mediaType"]:checked')?.value;

        if (selectedType === 'image') {
            mediaFileInputGroupModal.style.display = 'block';
            // mediaUrlInputGroupModal.style.display = 'none'; // Supprimé
            // Le fichier image est requis pour un nouvel article, optionnel pour une modification
            mediaFileModalInput.required = !isEditing;
            // mediaUrlModalInput.required = false; // Supprimé
            if (isEditing) {
                mediaFileModalInput.value = ''; // Clear any previously selected file
            }
        } 
        // La logique pour 'video' est supprimée
    }

    // Ouvrir le modal pour ajouter un article
    if (addArticleBtn) {
        addArticleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            modalTitle.textContent = 'Nouvel article';
            articleForm.reset();
            articleIdInput.value = '';
            // document.getElementById('imageTypeModal').checked = true; // Supprimé car plus de choix de type
            mediaFileInputGroupModal.style.display = 'block'; // Le champ image est toujours visible
            mediaFileModalInput.required = true; // L'image est requise pour un nouvel article
            modal.style.display = 'flex';
        });
    }
    
    // Fermer le modal
    if(closeModalBtn) {
        closeModalBtn.addEventListener('click', function() {
            modal.style.display = 'none';
        });
    }
    
    // Fermer le modal en cliquant à l'extérieur
    window.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Gestion de la soumission du formulaire
    if (articleForm) {
        articleForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const formData = new FormData();
            const articleId = articleIdInput.value;
            let method = articleId ? 'PUT' : 'POST';
            let url = articleId ? `/admin/articles/${articleId}` : '/admin/articles';

            formData.append('title', titleModalInput.value.trim());
            formData.append('description', descriptionModalInput.value.trim());
            formData.append('mediaType', 'image'); // Toujours 'image'
            formData.append('_csrf', csrfToken); // Ajouter le token CSRF au FormData

            if (mediaFileModalInput.files.length > 0) {
                formData.append('mediaFile', mediaFileModalInput.files[0]);
            } else if (!articleId) { // Si c'est un nouvel article (pas d'ID), le fichier est requis
                alert('Veuillez sélectionner un fichier image.');
                return;
            }
            // Si c'est une modification (articleId existe) et aucun fichier n'est sélectionné,
            // le backend (s'il y a une route PUT) ne devrait pas modifier l'image existante.
            // La route POST actuelle dans app.js ne gère pas les modifications.

            // Afficher un indicateur de chargement (optionnel)
            const submitButton = articleForm.querySelector('button[type="submit"]');
            if (!submitButton) { // Vérification de sécurité
                console.error("Bouton de soumission non trouvé");
                return;
            }
            const originalButtonText = submitButton.textContent;
            submitButton.textContent = 'Enregistrement...';
            submitButton.disabled = true;

            fetch(url, {
                method: method,
                body: formData
            })
            .then(response => {
                if (response.ok) {
                    return response.json(); // S'attendre à du JSON pour POST et PUT
                } 
                // Si la réponse n'est pas OK, lire le corps une seule fois
                return response.text().then(text => {
                    try {
                        // Essayer de parser comme JSON
                        const errBody = JSON.parse(text);
                        throw new Error(errBody.message || text || `Erreur HTTP ${response.status}`);
                    } catch (e) {
                        // Si ce n'est pas du JSON, utiliser le texte brut ou un message par défaut
                        throw new Error(text || `Erreur HTTP ${response.status}`);
                    }
                });
            })
            .then(data => {
                // alert(data.message); // Optionnel: afficher le message de succès
                window.location.reload();
            })
            .catch(error => {
                console.error('Erreur lors de la soumission du formulaire:', error);
                // error.message devrait maintenant contenir le message d'erreur du serveur ou "Failed to fetch"
                alert(error.message || 'Une erreur est survenue lors de l\'enregistrement.');
            }).finally(() => {
                // Restaurer le bouton
                submitButton.textContent = originalButtonText;
                submitButton.disabled = false;
            });
        });
    }
    
    // Gestion des boutons de suppression
    deleteButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const articleId = this.getAttribute('data-id');
            // L'accolade fermante de la fonction addEventListener était mal placée.
            // Le bloc if (confirm(...)) doit être à l'intérieur de la fonction de rappel.
            if (confirm('Êtes-vous sûr de vouloir supprimer cet article ?')) {
                fetch(`/admin/articles/${articleId}/delete`, {
                    method: 'POST',
                    headers: {
                        'X-CSRF-Token': csrfToken // Envoyer le token CSRF dans un header pour les requêtes non-formdata POST/PUT/DELETE
                    }
                })
                .then(response => {
                    if (response.ok) {
                        return response.json(); // S'attendre à du JSON
                    }
                    // Si la réponse n'est pas OK, lire le corps une seule fois
                    return response.text().then(text => {
                        try {
                            // Essayer de parser comme JSON
                            const errBody = JSON.parse(text);
                            throw new Error(errBody.message || text || `Erreur HTTP ${response.status}`);
                        } catch (e) {
                            // Si ce n'est pas du JSON, utiliser le texte brut ou un message par défaut
                            throw new Error(text || 'Erreur de suppression inconnue');
                        }
                    });
                // } // Cette accolade était en trop ou mal placée
            }) // Fin de .then(response => ...)
            .then(data => {
                // alert(data.message); // Optionnel: afficher le message de succès
                window.location.reload();
            })
            .catch(error => {
                console.error('Erreur lors de la suppression:', error);
                alert(error.message || 'Une erreur est survenue lors de la suppression.');
            });
        } // Fin de if (confirm(...))
    }); // Fin de button.addEventListener
});
}); // Fin de deleteButtons.forEach