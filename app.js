const dbName = "KulinariumDB";
let db;

const request = indexedDB.open(dbName, 1);
request.onupgradeneeded = e => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("dishes")) {
        db.createObjectStore("dishes", { keyPath: "id" });
    }
};
request.onsuccess = e => { 
    db = e.target.result; 
    loadCards(); 
};
request.onerror = e => console.error("Błąd bazy danych", e);

let bsModal;
document.addEventListener("DOMContentLoaded", () => {
    bsModal = new bootstrap.Modal(document.getElementById('modal'));
});

const form = document.getElementById('dish-form');
const container = document.getElementById('cards-container');
const photoInput = document.getElementById('photo');
const photoPreview = document.getElementById('photo-preview');
let currentPhotoData = null;

document.getElementById('add-btn').onclick = () => {
    form.reset();
    document.getElementById('entry-id').value = '';
    
    photoPreview.src = ''; 
    photoPreview.classList.add('d-none'); 
    
    document.getElementById('geo-status').innerText = 'Brak lokalizacji';
    document.getElementById('geo-status').className = 'small text-muted fw-bold';
    document.getElementById('lat').value = '';
    document.getElementById('lng').value = '';
    
    document.getElementById('modal-title').innerText = 'Nowe Danie';
    currentPhotoData = null;
    
    bsModal.show();
};