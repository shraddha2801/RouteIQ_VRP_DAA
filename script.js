const API_URL = "http://127.0.0.1:8080/api/optimize";

const sampleCustomers = [
    { id: 1, x: 20, y: 30, demand: 5, address: "" },
    { id: 2, x: 60, y: 20, demand: 8, address: "" },
    { id: 3, x: 80, y: 70, demand: 4, address: "" },
    { id: 4, x: 30, y: 80, demand: 6, address: "" }
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
            <td><input type="text" aria-label="Customer ${c.id} address or place" data-field="address"
                placeholder="Address / place" value="${escapeHTML(c.address || "")}"></td>
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
            if (field === "address") {
                customer.address = event.target.value.trim();
                updateMapPreview();
                hideOldResults();
                setStatus("Delivery address updated. Run optimization to refresh route results.");
                return;
            }
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
    $("depotAddress").value = "";

    renderCustomers();
    hideOldResults();
    updateMapPreview();
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

    customers.push({ id: nextId, x: 50, y: 50, demand: 3, address: "" });

    renderCustomers();
    hideOldResults();
    updateMapPreview();
    setStatus("Customer added. Enter its coordinates, demand and real-world address.");
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

function buildGoogleMapsDirections(route) {
    const depotAddress = ($("depotAddress")?.value || "").trim();
    if (!depotAddress) return "";
    const stopValues = Array.isArray(route.stops) ? route.stops : [];
    const orderedLocations = [];
    for (const stop of stopValues) {
        const label = String(stop);
        if (label === "0" || /depot/i.test(label)) {
            orderedLocations.push(depotAddress);
            continue;
        }
        const match = label.match(/\d+/);
        if (!match) continue;
        const customer = customers.find(c => c.id === Number(match[0]));
        if (customer && customer.address) orderedLocations.push(customer.address);
    }
    if (orderedLocations.length < 2) return "";
    // Use the first and last route locations as origin/destination; intermediate stops become waypoints.
    const origin = orderedLocations[0];
    const destination = orderedLocations[orderedLocations.length - 1];
    const waypoints = orderedLocations.slice(1, -1);
    const params = new URLSearchParams({
        api: "1",
        origin,
        destination,
        travelmode: "driving"
    });
    if (waypoints.length) params.set("waypoints", waypoints.join("|"));
    return "https://www.google.com/maps/dir/?" + params.toString();
}

function updateMapPreview() {
    const depotAddress = ($("depotAddress")?.value || "").trim();
    const firstCustomerAddress = customers.find(c => (c.address || "").trim())?.address || "";
    const query = depotAddress || firstCustomerAddress;
    const frame = $("googleMapFrame");
    const link = $("openGoogleMaps");
    if (query) {
        const encoded = encodeURIComponent(query);
        if (frame) frame.src = `https://maps.google.com/maps?q=${encoded}&output=embed`;
        if (link) link.href = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    } else {
        if (frame) frame.src = "https://maps.google.com/maps?q=India&output=embed";
        if (link) link.href = "https://maps.google.com/";
    }
}

function displayCustomResults(result) {
    const container = $("customResults");
    const body = $("customResultsBody");
    const driverName = ($("driverName")?.value || "").trim();
    const driverPhone = ($("driverPhone")?.value || "").trim();
    const driverVehicle = ($("driverVehicle")?.value || "").trim();
    const driverInfo = (driverName || driverPhone || driverVehicle)
        ? `<div class="driver-assignment"><strong>Delivery person:</strong> ${escapeHTML(driverName || "Not provided")}<br>
           <strong>Phone:</strong> ${escapeHTML(driverPhone || "Not provided")}<br>
           <strong>Vehicle registration:</strong> ${escapeHTML(driverVehicle || "Not provided")}</div>`
        : `<div class="driver-assignment">Delivery-person details have not been entered yet.</div>`;

    body.innerHTML = `
        <div class="custom-result-card">
            <strong>Route plan summary</strong>
            <p>Algorithm: ${escapeHTML(result.algorithm)}</p>
            <p>Total route distance: ${Number(result.totalDistance).toFixed(2)} distance units</p>
            <p>Vehicles assigned: ${result.vehiclesUsed}</p>
            <p>Delivery stops: ${customers.length}</p>
            <p>Capacity utilization: ${Number(result.capacityUtilization).toFixed(1)}%</p>
            ${driverInfo}
        </div>
        ${result.routes.map(route => {
            const directionsUrl = buildGoogleMapsDirections(route);
            return `
            <div class="custom-result-card">
                <strong>Delivery route ${route.vehicle}</strong>
                <p>Start / end: ${escapeHTML($("depotAddress")?.value.trim() || "Depot coordinates")}</p>
                <p>Stop sequence: ${route.stops.map(escapeHTML).join(" → ")}</p>
                <p>Assigned load: ${route.load}/${route.capacity}</p>
                <p>Route distance: ${Number(route.distance).toFixed(2)} distance units</p>
                ${directionsUrl
                    ? `<a class="route-direction-link" href="${escapeHTML(directionsUrl)}" target="_blank" rel="noopener noreferrer">View driving directions in Google Maps ↗</a>`
                    : `<p>Enter the depot address and the addresses for this route's stops to create Google Maps directions.</p>`}
            </div>`;
        }).join("")}
    `;
    container.style.display = "block";
    updateMapPreview();
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
            error.message || "Could not connect to the C++ optimization API. Check that the server is running.",
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
                `Total route distance: ${Number(result.totalDistance).toFixed(2)} distance units`
            );
        })
        .catch(error => {
            console.error(error);
            alert("Could not connect to the C++ API. Check that server.exe is running.");
        })
        .finally(() => {
            button.disabled = false;
            button.innerHTML = oldText;
            if ($("googleMapFrame")) updateMapPreview();
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
    if ($("depotAddress")) {
        $("depotAddress").addEventListener("change", () => {
            updateMapPreview();
            hideOldResults();
        });
        $("depotAddress").addEventListener("input", updateMapPreview);
    }
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

if ($("googleMapFrame")) updateMapPreview();
if (window.lucide) window.lucide.createIcons();
