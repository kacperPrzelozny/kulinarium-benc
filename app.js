const dbName = "KulinariumDB";
let db;

const request = indexedDB.open(dbName, 1);
request.onupgradeneeded = e => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("dishes")) db.createObjectStore("dishes", { keyPath: "id" });
};
request.onsuccess = e => { 
    db = e.target.result; 
    loadCards(); 
};

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
    
    window.addEventListener('online', () => showToast("Połączono z siecią", "success"));
    window.addEventListener('offline', () => showToast("Tryb offline - dane zapisują się lokalnie", "warning"));
});

function showToast(message, type = 'primary') {
    const toastContainer = document.getElementById('toast-container');
    const toastHtml = `
        <div class="toast align-items-center text-white bg-${type} border-0 show shadow mb-2" role="alert">
            <div class="d-flex">
                <div class="toast-body fw-bold">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>`;
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    const lastToast = toastContainer.lastElementChild;
    setTimeout(() => { if(lastToast) lastToast.remove(); }, 3500);
}

window.exportData = () => {
    const tx = db.transaction("dishes", "readonly");
    tx.objectStore("dishes").getAll().onsuccess = e => {
        const data = JSON.stringify(e.target.result, null, 2);
        const blob = new Blob([data], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kulinarium-backup-${new Date().toLocaleDateString('pl-PL')}.json`;
        a.click();
        showToast("Eksport danych zakończony", "success");
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
                showToast("Pomyślnie zaimportowano wpisy!", "success");
                loadCards();
            };
        } catch (err) { showToast("Niepoprawny plik kopii zapasowej", "danger"); }
    };
    reader.readAsText(file);
});

searchInput.addEventListener('input', e => loadCards(e.target.value));

document.getElementById('add-btn').onclick = () => {
    form.reset();
    document.getElementById('entry-id').value = '';
    photoPreview.src = ''; photoPreview.classList.add('d-none'); 
    document.getElementById('geo-status').innerText = 'Pobierz lokalizację GPS';
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
            const MAX_WIDTH = 1000; // Nieco większa rozdzielczość dla jakości
            const scale = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            currentPhotoData = canvas.toDataURL('image/jpeg', 0.8);
            photoPreview.src = currentPhotoData;
            photoPreview.classList.remove('d-none');
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

document.getElementById('geo-btn').onclick = () => {
    const status = document.getElementById('geo-status');
    status.innerText = "Namierzanie...";
    navigator.geolocation.getCurrentPosition(
        pos => {
            document.getElementById('lat').value = pos.coords.latitude;
            document.getElementById('lng').value = pos.coords.longitude;
            status.innerHTML = `<span class="text-success fw-bold"><i class="bi bi-check2-all"></i> Lokalizacja zapisana</span>`;
        },
        () => { status.innerHTML = `<span class="text-danger">Nie udało się pobrać GPS</span>`; }
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
        photo: currentPhotoData || 'https://via.placeholder.com/400x250?text=Kulinarium'
    };
    const tx = db.transaction("dishes", "readwrite");
    tx.objectStore("dishes").put(dish);
    tx.oncomplete = () => { 
        bsModal.hide(); 
        loadCards(searchInput.value);
        showToast("Danie zapisane pomyślnie!", "primary");
    };
};

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
            container.innerHTML = `<div class="col-12 text-center text-muted mt-5 py-5 border rounded-4 bg-white"><i class="bi bi-egg fs-1"></i><p class="mt-3">Brak wpisów pasujących do Twoich kryteriów.</p></div>`;
            return;
        }
        dishes.forEach(dish => {
            const card = document.createElement('div');
            card.className = 'col-12 col-md-6 col-lg-4';
            const mapBtn = dish.lat ? `<a href="https://www.google.com/maps/search/?api=1&query=${dish.lat},${dish.lng}" target="_blank" class="btn btn-sm btn-light rounded-pill border shadow-sm" title="Pokaż na mapie"><i class="bi bi-geo-alt text-danger"></i></a>` : '';
            
            card.innerHTML = `
                <div class="card h-100 shadow-sm border-0 rounded-4 overflow-hidden dish-card bg-white">
                    <img src="${dish.photo}" class="card-img-top" style="height:220px; object-fit:cover;" loading="lazy">
                    <div class="card-body d-flex flex-column p-4">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h5 class="text-primary fw-bold mb-0">${dish.name}</h5>
                            <span class="badge bg-warning text-dark border-0 rounded-pill px-3 py-2 shadow-sm">${dish.rating}/10</span>
                        </div>
                        <p class="small text-muted mb-3 fw-bold"><i class="bi bi-shop text-primary me-1"></i> ${dish.restaurant}</p>
                        <p class="small flex-grow-1 text-secondary" style="line-height: 1.6;">${dish.description || 'Nie dodano jeszcze opisu dla tego dania.'}</p>
                        <div class="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
                            <span class="fw-bold fs-5 text-dark">${dish.price} <small>zł</small></span>
                            <div class="d-flex gap-2">
                                ${mapBtn}
                                <button class="btn btn-sm btn-light rounded-pill border shadow-sm" onclick="shareDish('${dish.id}')" title="Udostępnij"><i class="bi bi-share text-primary"></i></button>
                                <button class="btn btn-sm btn-light rounded-pill border shadow-sm" onclick="editDish('${dish.id}')" title="Edytuj"><i class="bi bi-pencil text-secondary"></i></button>
                                <button class="btn btn-sm btn-light rounded-pill border shadow-sm" onclick="deleteDish('${dish.id}')" title="Usuń"><i class="bi bi-trash text-danger"></i></button>
                            </div>
                        </div>
                    </div>
                </div>`;
            container.appendChild(card);
        });
    };
}

window.shareDish = id => {
    const tx = db.transaction("dishes", "readonly");
    tx.objectStore("dishes").get(id).onsuccess = e => {
        const d = e.target.result;
        if (navigator.share) {
            navigator.share({ 
                title: `Kulinarium: ${d.name}`, 
                text: `Polecam danie ${d.name} w ${d.restaurant}! Moja ocena to ${d.rating}/10.`, 
                url: window.location.href 
            }).catch(() => {});
        } else {
            showToast("Udostępnianie nie jest wspierane", "warning");
        }
    };
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
        document.getElementById('modal-title').innerText = 'Edytuj Wpis';
        document.getElementById('geo-status').innerText = d.lat ? 'GPS zapisany' : 'Pobierz lokalizację GPS';
        bsModal.show();
    };
};

window.deleteDish = id => {
    if (confirm("Czy na pewno chcesz usunąć to wspomnienie?")) {
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
                    showToast("Nowa wersja dostępna! Odśwież stronę.", "info");
                }
            };
        };
    });
}