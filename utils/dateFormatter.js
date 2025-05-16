// c:\Users\pouye\Desktop\ANEEEX2\utils\dateFormatter.js
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

module.exports = { formatDate };
