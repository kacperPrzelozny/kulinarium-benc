const dbName = "KulinariumDB";
let db;

const request = indexedDB.open(dbName, 1);
request.onupgradeneeded = e => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("dishes")) db.createObjectStore("dishes", { keyPath: "id" });
};
request.onsuccess = e => { db = e.target.result; loadCards(); };

let bsModal;
const form = document.getElementById('dish-form');
const container = document.getElementById('cards-container');
const photoInput = document.getElementById('photo');
const photoPreview = document.getElementById('photo-preview');
const searchInput = document.getElementById('search-input');
const importInput = document.getElementById('import-input');
let currentPhotoData = null;

document.addEventListener("DOMContentLoaded", () => {
    bsModal = new bootstrap.Modal(document.getElementById('modal'));
    
    // DETEKCJA STATUSU SIECI
    window.addEventListener('online', () => showToast("Jesteś z powrotem online!", "success"));
    window.addEventListener('offline', () => showToast("Działasz w trybie offline. Dane zapiszą się lokalnie.", "warning"));
    if (!navigator.onLine) showToast("Brak połączenia z siecią.", "warning");
});

function showToast(message, type = 'primary') {
    const toastContainer = document.getElementById('toast-container');
    const toastHtml = `
        <div class="toast align-items-center text-white bg-${type} border-0 show shadow" role="alert">
            <div class="d-flex">
                <div class="toast-body fw-bold">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>`;
    toastContainer.innerHTML = toastHtml;
    const toastElement = toastContainer.querySelector('.toast');
    setTimeout(() => { if(toastElement) toastElement.remove(); }, 3000);
}

// BACKUP
window.exportData = () => {
    const tx = db.transaction("dishes", "readonly");
    tx.objectStore("dishes").getAll().onsuccess = e => {
        const data = JSON.stringify(e.target.result);
        const blob = new Blob([data], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kulinarium-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        showToast("Pobrano kopię zapasową", "success");
    };
};

importInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
        try {
            const importedData = JSON.parse(event.target.result);
            const tx = db.transaction("dishes", "readwrite");
            const store = tx.objectStore("dishes");
            importedData.forEach(item => store.put(item));
            tx.oncomplete = () => {
                showToast("Dane zaimportowane!", "success");
                loadCards();
            };
        } catch (err) { showToast("Błąd pliku!", "danger"); }
    };
    reader.readAsText(file);
});

// WYSZUKIWARKA
searchInput.addEventListener('input', e => loadCards(e.target.value));

// FORMULARZ
document.getElementById('add-btn').onclick = () => {
    form.reset();
    document.getElementById('entry-id').value = '';
    photoPreview.src = ''; photoPreview.classList.add('d-none'); 
    document.getElementById('geo-status').innerText = 'Brak lokalizacji';
    document.getElementById('lat').value = ''; document.getElementById('lng').value = '';
    document.getElementById('modal-title').innerText = 'Nowe Danie';
    currentPhotoData = null;
    bsModal.show();
};

photoInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const scale = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            currentPhotoData = canvas.toDataURL('image/jpeg', 0.7);
            photoPreview.src = currentPhotoData;
            photoPreview.classList.remove('d-none');
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

document.getElementById('geo-btn').onclick = () => {
    const status = document.getElementById('geo-status');
    status.innerText = "Pobieranie...";
    navigator.geolocation.getCurrentPosition(
        pos => {
            document.getElementById('lat').value = pos.coords.latitude;
            document.getElementById('lng').value = pos.coords.longitude;
            status.innerHTML = `<span class="text-success">Lokalizacja zapisana!</span>`;
        },
        () => { status.innerText = "Błąd GPS."; }
    );
};

form.onsubmit = e => {
    e.preventDefault();
    const id = document.getElementById('entry-id').value || Date.now().toString();
    const dish = {
        id: id,
        name: document.getElementById('name').value,
        restaurant: document.getElementById('restaurant').value,
        price: document.getElementById('price').value,
        rating: document.getElementById('rating').value,
        description: document.getElementById('description').value,
        lat: document.getElementById('lat').value,
        lng: document.getElementById('lng').value,
        photo: currentPhotoData || 'https://via.placeholder.com/400x250?text=Brak+zdjęcia'
    };
    const tx = db.transaction("dishes", "readwrite");
    tx.objectStore("dishes").put(dish);
    tx.oncomplete = () => { 
        bsModal.hide(); 
        loadCards(searchInput.value);
        showToast("Danie zapisane!", "primary");
    };
};

// RENDEROWANIE
function loadCards(filter = "") {
    if (!db) return;
    const tx = db.transaction("dishes", "readonly");
    tx.objectStore("dishes").getAll().onsuccess = e => {
        container.innerHTML = '';
        let dishes = e.target.result.sort((a, b) => b.id - a.id);
        if (filter) {
            const f = filter.toLowerCase();
            dishes = dishes.filter(d => d.name.toLowerCase().includes(f) || d.restaurant.toLowerCase().includes(f));
        }
        if (dishes.length === 0) {
            container.innerHTML = `<div class="col-12 text-center text-muted mt-5"><i class="bi bi-search fs-1"></i><p>Nic nie znaleziono.</p></div>`;
            return;
        }
        dishes.forEach(dish => {
            const card = document.createElement('div');
            card.className = 'col-12 col-md-6 col-lg-4';
            const mapBtn = dish.lat ? `<a href="https://www.google.com/maps?q=${dish.lat},${dish.lng}" target="_blank" class="btn btn-sm btn-light rounded-pill"><i class="bi bi-geo-alt text-danger"></i></a>` : '';
            
            card.innerHTML = `
                <div class="card h-100 shadow-sm border-0 rounded-4 overflow-hidden dish-card">
                    <img src="${dish.photo}" class="card-img-top" style="height:220px; object-fit:cover;">
                    <div class="card-body d-flex flex-column">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h5 class="text-primary fw-bold mb-0">${dish.name}</h5>
                            <span class="badge bg-warning text-dark border-0 rounded-pill">${dish.rating}/10</span>
                        </div>
                        <p class="small text-muted mb-2"><i class="bi bi-shop"></i> ${dish.restaurant}</p>
                        <p class="small flex-grow-1 text-secondary">${dish.description || ''}</p>
                        <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                            <span class="fw-bold fs-5">${dish.price} zł</span>
                            <div class="d-flex gap-1">
                                ${mapBtn}
                                <button class="btn btn-sm btn-light rounded-pill" onclick="shareDish('${dish.id}')"><i class="bi bi-share text-primary"></i></button>
                                <button class="btn btn-sm btn-light rounded-pill" onclick="editDish('${dish.id}')"><i class="bi bi-pencil text-secondary"></i></button>
                                <button class="btn btn-sm btn-light rounded-pill" onclick="deleteDish('${dish.id}')"><i class="bi bi-trash text-danger"></i></button>
                            </div>
                        </div>
                    </div>
                </div>`;
            container.appendChild(card);
        });
    };
}

window.shareDish = id => {
    if (navigator.share) navigator.share({ title: 'Kulinarium', url: window.location.href });
    else showToast("Twoja przeglądarka nie wspiera Share API", "warning");
};

window.editDish = id => {
    const tx = db.transaction("dishes", "readonly");
    tx.objectStore("dishes").get(id).onsuccess = e => {
        const d = e.target.result;
        document.getElementById('entry-id').value = d.id;
        document.getElementById('name').value = d.name;
        document.getElementById('restaurant').value = d.restaurant;
        document.getElementById('price').value = d.price;
        document.getElementById('rating').value = d.rating;
        document.getElementById('description').value = d.description;
        document.getElementById('lat').value = d.lat || '';
        document.getElementById('lng').value = d.lng || '';
        currentPhotoData = d.photo;
        photoPreview.src = d.photo;
        photoPreview.classList.remove('d-none');
        document.getElementById('modal-title').innerText = 'Edytuj Danie';
        bsModal.show();
    };
};

window.deleteDish = id => {
    if (confirm("Usunąć ten wpis?")) {
        const tx = db.transaction("dishes", "readwrite");
        tx.objectStore("dishes").delete(id);
        tx.oncomplete = () => {
            loadCards(searchInput.value);
            showToast("Usunięto wpis.", "danger");
        };
    }
};

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
        reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    showToast("Dostępna nowa wersja! Odśwież stronę.", "info");
                }
            };
        };
    });
}