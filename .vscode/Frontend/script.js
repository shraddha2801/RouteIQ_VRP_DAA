const API_URL = "http://127.0.0.1:8080/api/optimize";

const sampleCustomers = [
    { id: 1, x: 20, y: 30, demand: 5 },
    { id: 2, x: 60, y: 20, demand: 8 },
    { id: 3, x: 80, y: 70, demand: 4 },
    { id: 4, x: 30, y: 80, demand: 6 }
];

let customers = sampleCustomers.map(c => ({ ...c }));

const $ = id => document.getElementById(id);

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function renderCustomers() {
    const body = $("customerTableBody");
    if (!body) return;

    body.innerHTML = customers.map(c => `
        <tr data-id="${c.id}">
            <td>${c.id}</td>
            <td><input type="number" step="any" aria-label="Customer ${c.id} X coordinate"
                data-field="x" value="${c.x}"></td>
            <td><input type="number" step="any" aria-label="Customer ${c.id} Y coordinate"
                data-field="y" value="${c.y}"></td>
            <td><input type="number" min="1" step="1" aria-label="Customer ${c.id} demand"
                data-field="demand" value="${c.demand}"></td>
            <td><button type="button" class="remove-customer" data-remove="${c.id}"
                aria-label="Remove customer ${c.id}">×</button></td>
        </tr>
    `).join("");

    body.querySelectorAll("input").forEach(input => {
        input.addEventListener("change", event => {
            const row = event.target.closest("tr");
            const id = Number(row.dataset.id);
            const customer = customers.find(c => c.id === id);
            if (!customer) return;

            const field = event.target.dataset.field;
            const value = Number(event.target.value);

            if (!Number.isFinite(value) ||
                (field === "demand" && (!Number.isInteger(value) || value < 1))) {
                setStatus(
                    field === "demand"
                        ? "Demand must be a positive whole number."
                        : "Coordinates must be valid numbers.",
                    "error"
                );
                event.target.value = customer[field];
                return;
            }

            customer[field] = value;
            updateSummary();
            hideOldResults();
            setStatus("Dataset updated. Run optimization to calculate new routes.");
        });
    });

    body.querySelectorAll("[data-remove]").forEach(button => {
        button.addEventListener("click", () => {
            const id = Number(button.dataset.remove);
            customers = customers.filter(c => c.id !== id);
            renderCustomers();
            updateSummary();
            hideOldResults();
            setStatus("Customer removed from the dataset.");
        });
    });

    updateSummary();
}

function updateSummary() {
    const totalDemand = customers.reduce((sum, c) => sum + c.demand, 0);
    const capacity = Number($("vehicleCapacity")?.value) || 0;

    if ($("customerCountTag"))
        $("customerCountTag").textContent =
            `${customers.length} customer${customers.length === 1 ? "" : "s"}`;

    if ($("summaryCustomers"))
        $("summaryCustomers").textContent = customers.length;

    if ($("summaryDemand"))
        $("summaryDemand").textContent = totalDemand;

    if ($("summaryCapacity"))
        $("summaryCapacity").textContent = capacity;

    if ($("summaryVehicles"))
        $("summaryVehicles").textContent =
            capacity > 0 ? Math.ceil(totalDemand / capacity) : "—";
}

function setStatus(message, type = "") {
    const status = $("optimizerStatus");
    if (!status) return;

    status.textContent = message;
    status.className = "form-note" + (type ? " " + type : "");
}

function hideOldResults() {
    const results = $("customResults");
    if (results) results.style.display = "none";
}

function resetSample() {
    customers = sampleCustomers.map(c => ({ ...c }));

    $("depotX").value = 50;
    $("depotY").value = 50;
    $("vehicleCapacity").value = 15;

    renderCustomers();
    hideOldResults();
    setStatus("Sample dataset restored.");
}

function addCustomer() {
    if (customers.length >= 100) {
        setStatus("Maximum of 100 customers reached.", "error");
        return;
    }

    const nextId = customers.length
        ? Math.max(...customers.map(c => c.id)) + 1
        : 1;

    customers.push({ id: nextId, x: 50, y: 50, demand: 3 });

    renderCustomers();
    hideOldResults();
    setStatus("Customer added. Edit its coordinates and demand.");
}

function validateDataset() {
    const capacity = Number($("vehicleCapacity").value);
    const depotX = Number($("depotX").value);
    const depotY = Number($("depotY").value);

    if (!Number.isFinite(depotX) || !Number.isFinite(depotY)) {
        setStatus("Depot coordinates must be valid numbers.", "error");
        return false;
    }

    if (!Number.isInteger(capacity) || capacity < 1) {
        setStatus("Vehicle capacity must be a positive whole number.", "error");
        return false;
    }

    if (customers.length === 0) {
        setStatus("Add at least one customer before optimizing.", "error");
        return false;
    }

    if (customers.some(c => c.demand > capacity)) {
        setStatus(
            "At least one customer demand exceeds vehicle capacity. Increase capacity or reduce that demand.",
            "error"
        );
        return false;
    }

    return true;
}

function displayCustomResults(result) {
    const container = $("customResults");
    const body = $("customResultsBody");

    body.innerHTML = `
        <div class="custom-result-card">
            <strong>Solution summary</strong>
            <p>Algorithm: ${escapeHTML(result.algorithm)}</p>
            <p>Total distance: ${Number(result.totalDistance).toFixed(2)}</p>
            <p>Vehicles used: ${result.vehiclesUsed}</p>
            <p>Capacity utilization: ${Number(result.capacityUtilization).toFixed(1)}%</p>
        </div>
        ${result.routes.map(route => `
            <div class="custom-result-card">
                <strong>Vehicle ${route.vehicle}</strong>
                <p>Route: ${route.stops.map(escapeHTML).join(" → ")}</p>
                <p>Load: ${route.load}/${route.capacity}</p>
                <p>Distance: ${Number(route.distance).toFixed(2)}</p>
            </div>
        `).join("")}
    `;

    container.style.display = "block";
}

async function optimizeCustomNetwork() {
    if (!validateDataset()) return;

    const button = $("runCustomOptimization");
    const oldText = button.textContent;

    button.disabled = true;
    button.textContent = "Optimizing...";

    const payload = {
        depot: {
            x: Number($("depotX").value),
            y: Number($("depotY").value)
        },
        capacity: Number($("vehicleCapacity").value),
        customers: customers.map(c => ({
            id: c.id,
            x: c.x,
            y: c.y,
            demand: c.demand
        }))
    };

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok)
            throw new Error(result.error || "Optimization request failed.");

        displayCustomResults(result);
        setStatus("Optimization completed successfully.", "success");
    } catch (error) {
        console.error("RouteIQ optimization error:", error);
        setStatus(
            "The custom dataset API is not connected yet. We need to update server.cpp to accept POST requests.",
            "error"
        );
    } finally {
        button.disabled = false;
        button.textContent = oldText;
    }
}

function optimizeDashboard() {
    const button = $("optimizeBtn");
    if (!button) return;

    button.disabled = true;
    const oldText = button.innerHTML;
    button.textContent = "Optimizing...";

    fetch(API_URL)
        .then(response => {
            if (!response.ok) throw new Error("API request failed.");
            return response.json();
        })
        .then(result => {
            $("distanceValue").innerHTML =
                `${Number(result.totalDistance).toFixed(2)} <small>units</small>`;
            $("vehicleValue").innerHTML =
                `${String(result.vehiclesUsed).padStart(2, "0")} <small>vehicles</small>`;
            $("locationValue").innerHTML =
                `${String(result.customerCount).padStart(2, "0")} <small>stops</small>`;
            $("utilValue").innerHTML =
                `${Number(result.capacityUtilization).toFixed(1)}<small>%</small>`;

            alert(
                `Optimization complete!\n` +
                `Algorithm: ${result.algorithm}\n` +
                `Vehicles: ${result.vehiclesUsed}\n` +
                `Distance: ${Number(result.totalDistance).toFixed(2)}`
            );
        })
        .catch(error => {
            console.error(error);
            alert("Could not connect to the C++ API. Check that server.exe is running.");
        })
        .finally(() => {
            button.disabled = false;
            button.innerHTML = oldText;
            if (window.lucide) window.lucide.createIcons();
        });
}

if ($("customerTableBody")) {
    renderCustomers();

    $("addCustomerBtn").addEventListener("click", addCustomer);
    $("resetCustomersBtn").addEventListener("click", resetSample);
    $("runCustomOptimization").addEventListener("click", optimizeCustomNetwork);

    $("vehicleCapacity").addEventListener("input", () => {
        updateSummary();
        hideOldResults();
    });

    ["depotX", "depotY"].forEach(id => {
        $(id).addEventListener("change", hideOldResults);
    });
}

if ($("optimizeBtn")) {
    $("optimizeBtn").addEventListener("click", optimizeDashboard);
}

document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".nav-item").forEach(item =>
            item.classList.remove("active")
        );
        button.classList.add("active");

        const page = button.dataset.page;
        const overviewVisible = page === "overview";

        document.querySelectorAll(
            ".main > .topbar, .main > .welcome, .main > .section-heading, " +
            ".main > .stats-grid, .main > .content-grid, .main > footer"
        ).forEach(element => {
            element.style.display = overviewVisible ? "" : "none";
        });

        if ($("optimizerPage"))
            $("optimizerPage").style.display =
                page === "optimizer" ? "block" : "none";

        if (page === "performance") {
            alert("Performance Lab is our next feature to build.");
        }
    });
});

if (window.lucide) window.lucide.createIcons();
