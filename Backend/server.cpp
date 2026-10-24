#include <iostream>
#include <vector>
#include <cmath>
#include <iomanip>
#include <algorithm>
#include <sstream>
#include <string>
#include <winsock2.h>
#include <ws2tcpip.h>

using namespace std;

struct Customer {
    int id;
    double x, y;
    int demand;
};

struct Saving {
    double value;
    int i, j;
};

double distanceBetween(const Customer& a, const Customer& b) {
    return hypot(a.x - b.x, a.y - b.y);
}

double routeDistance(const vector<int>& route,
                     const vector<vector<double> >& dist) {
    double total = 0;
    for (int i = 0; i + 1 < (int)route.size(); ++i)
        total += dist[route[i]][route[i + 1]];
    return total;
}

// Read a numeric field from a small JSON object.
bool getNumber(const string& json, const string& key, double& value) {
    string search = "\"" + key + "\"";
    size_t p = json.find(search);

    if (p == string::npos) return false;

    p = json.find(':', p + search.size());
    if (p == string::npos) return false;

    ++p;
    while (p < json.size() && json[p] == ' ') ++p;

    try {
        size_t used = 0;
        value = stod(json.substr(p), &used);
        return used > 0 && isfinite(value);
    } catch (...) {
        return false;
    }
}

bool getInteger(const string& json, const string& key, int& value) {
    double number;
    if (!getNumber(json, key, number)) return false;
    if (number != floor(number) || number < 0 || number > 1000000)
        return false;
    value = (int)number;
    return true;
}

string errorJson(const string& message) {
    // Keep error strings safe for JSON.
    string safe;
    for (char c : message) {
        if (c == '"' || c == '\\') safe += '\\';
        if (c != '\n' && c != '\r') safe += c;
    }
    return "{\"error\":\"" + safe + "\"}";
}

string optimizeRoutes(const string& requestBody) {
    double depotX = 50, depotY = 50;
    int capacity = 15;

    size_t depotStart = requestBody.find("\"depot\"");
    size_t customerStart = requestBody.find("\"customers\"");

    if (depotStart == string::npos || customerStart == string::npos)
        return errorJson("Expected depot and customers in the request.");

    size_t depotEnd = requestBody.find('}', depotStart);
    if (depotEnd == string::npos || depotEnd > customerStart)
        return errorJson("Invalid depot object.");

    string depotJson = requestBody.substr(
        depotStart, depotEnd - depotStart + 1);

    if (!getNumber(depotJson, "x", depotX) ||
        !getNumber(depotJson, "y", depotY))
        return errorJson("Depot requires numeric x and y coordinates.");

    if (!getInteger(requestBody, "capacity", capacity) || capacity < 1)
        return errorJson("Capacity must be a positive integer.");

    size_t arrayStart = requestBody.find('[', customerStart);
    size_t arrayEnd = requestBody.find(']', arrayStart);

    if (arrayStart == string::npos || arrayEnd == string::npos)
        return errorJson("Invalid customers array.");

    string arrayJson = requestBody.substr(
        arrayStart + 1, arrayEnd - arrayStart - 1);

    vector<Customer> customers;
    customers.push_back({0, depotX, depotY, 0});

    size_t pos = 0;
    while (pos < arrayJson.size()) {
        size_t open = arrayJson.find('{', pos);
        if (open == string::npos) break;

        size_t close = arrayJson.find('}', open);
        if (close == string::npos)
            return errorJson("Invalid customer object.");

        string obj = arrayJson.substr(open, close - open + 1);

        Customer c;
        double x, y;
        int id, demand;

        if (!getInteger(obj, "id", id) ||
            !getNumber(obj, "x", x) ||
            !getNumber(obj, "y", y) ||
            !getInteger(obj, "demand", demand) ||
            id < 1 || demand < 1)
            return errorJson("Each customer needs a positive id and demand, plus numeric coordinates.");

        if (demand > capacity)
            return errorJson("A customer demand exceeds vehicle capacity.");

        for (const Customer& existing : customers) {
            if (existing.id == id)
                return errorJson("Customer IDs must be unique.");
        }

        customers.push_back({id, x, y, demand});
        pos = close + 1;

        if (customers.size() > 101)
            return errorJson("Maximum of 100 customers allowed.");
    }

    if (customers.size() < 2)
        return errorJson("Add at least one customer.");

    const int n = (int)customers.size();

    vector<vector<double> > dist(n, vector<double>(n, 0.0));

    for (int i = 0; i < n; ++i)
        for (int j = i + 1; j < n; ++j)
            dist[i][j] = dist[j][i] =
                distanceBetween(customers[i], customers[j]);

    vector<Saving> savings;

    for (int i = 1; i < n; ++i) {
        for (int j = i + 1; j < n; ++j) {
            double value =
                dist[0][i] + dist[0][j] - dist[i][j];
            savings.push_back({value, i, j});
        }
    }

    sort(savings.begin(), savings.end(),
         [](const Saving& a, const Saving& b) {
             if (a.value != b.value) return a.value > b.value;
             if (a.i != b.i) return a.i < b.i;
             return a.j < b.j;
         });

    vector<vector<int> > routes(n);
    vector<int> loads(n, 0), active(n, 1), routeOf(n, -1);

    for (int i = 1; i < n; ++i) {
        routes[i - 1] = {0, i, 0};
        loads[i - 1] = customers[i].demand;
        routeOf[i] = i - 1;
    }

    for (const Saving& s : savings) {
        int ri = routeOf[s.i], rj = routeOf[s.j];

        if (ri == rj || !active[ri] || !active[rj]) continue;

        vector<int>& a = routes[ri];
        vector<int>& b = routes[rj];

        bool iEnd = a[1] == s.i || a[a.size() - 2] == s.i;
        bool jEnd = b[1] == s.j || b[b.size() - 2] == s.j;

        if (!iEnd || !jEnd) continue;
        if (loads[ri] + loads[rj] > capacity) continue;

        vector<int> left(a.begin() + 1, a.end() - 1);
        vector<int> right(b.begin() + 1, b.end() - 1);

        if (left.front() != s.i)
            reverse(left.begin(), left.end());

        if (right.back() != s.j)
            reverse(right.begin(), right.end());

        vector<int> merged(1, 0);
        merged.insert(merged.end(), left.begin(), left.end());
        merged.insert(merged.end(), right.begin(), right.end());
        merged.push_back(0);

        routes[ri] = merged;
        loads[ri] += loads[rj];
        loads[rj] = 0;
        active[rj] = 0;

        for (int c : merged)
            if (c != 0) routeOf[c] = ri;
    }

    double totalDistance = 0;
    int vehicles = 0, totalDemand = 0;

    for (int i = 1; i < n; ++i)
        totalDemand += customers[i].demand;

    ostringstream routeJson;
    routeJson << fixed << setprecision(2) << "[";

    bool first = true;

    for (int i = 0; i < n; ++i) {
        if (!active[i] || routes[i].size() <= 2) continue;

        double d = routeDistance(routes[i], dist);
        totalDistance += d;
        ++vehicles;

        if (!first) routeJson << ",";
        first = false;

        routeJson << "{\"vehicle\":" << vehicles
                  << ",\"load\":" << loads[i]
                  << ",\"capacity\":" << capacity
                  << ",\"distance\":" << d
                  << ",\"stops\":[";

        for (int j = 0; j < (int)routes[i].size(); ++j) {
            if (j) routeJson << ",";
            routeJson << customers[routes[i][j]].id;
        }

        routeJson << "]}";
    }

    routeJson << "]";

    double utilization = vehicles
        ? 100.0 * totalDemand / (vehicles * capacity) : 0.0;

    ostringstream out;
    out << fixed << setprecision(2)
        << "{\"algorithm\":\"Clarke-Wright Savings\","
        << "\"vehiclesUsed\":" << vehicles << ","
        << "\"totalDistance\":" << totalDistance << ","
        << "\"customerCount\":" << n - 1 << ","
        << "\"totalDemand\":" << totalDemand << ","
        << "\"capacityPerVehicle\":" << capacity << ","
        << "\"capacityUtilization\":" << utilization << ","
        << "\"routes\":" << routeJson.str() << "}";

    return out.str();
}

int main() {
    WSADATA wsa;
    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
        cerr << "Winsock initialization failed.\n";
        return 1;
    }

    SOCKET server = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (server == INVALID_SOCKET) {
        cerr << "Socket creation failed.\n";
        WSACleanup();
        return 1;
    }

    sockaddr_in addr;
    addr.sin_family = AF_INET;
    addr.sin_port = htons(8080);
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);

    if (bind(server, (sockaddr*)&addr, sizeof(addr)) == SOCKET_ERROR) {
        cerr << "Port 8080 is busy. Stop the old server first.\n";
        closesocket(server);
        WSACleanup();
        return 1;
    }

    listen(server, 5);
    cout << "RouteIQ C++ API running at http://127.0.0.1:8080\n";

    while (true) {
        SOCKET client = accept(server, NULL, NULL);
        if (client == INVALID_SOCKET) continue;

        string request;
        char buffer[8192];
        int received;
        while ((received = recv(client, buffer, sizeof(buffer), 0)) > 0) {
            request.append(buffer, received);
            size_t headerEnd = request.find("\r\n\r\n");
            if (headerEnd != string::npos) {
                size_t lenPos = request.find("Content-Length:");
                size_t expected = 0;
                if (lenPos != string::npos && lenPos < headerEnd) {
                    lenPos += 15;
                    while (lenPos < headerEnd && request[lenPos] == ' ')
                        ++lenPos;
                    expected = (size_t)atoi(request.c_str() + lenPos);
                }
                if (request.size() >= headerEnd + 4 + expected) break;
            } else if (request.size() >= sizeof(buffer) - 1) {
                break;
            }
        }

        string body;
        string status = "200 OK";
        string contentType = "application/json; charset=utf-8";
        size_t headerEnd = request.find("\r\n\r\n");

        if (request.find("OPTIONS ") == 0) {
            body = "";
        } else if (request.find("POST /api/optimize ") == 0) {
            if (headerEnd == string::npos) {
                status = "400 Bad Request";
                body = errorJson("Invalid HTTP request.");
            } else {
                body = optimizeRoutes(request.substr(headerEnd + 4));
                if (body.find("\"error\"") != string::npos)
                    status = "400 Bad Request";
            }
        } else if (request.find("GET /api/optimize ") == 0) {
            body = optimizeRoutes(
                "{\"depot\":{\"x\":50,\"y\":50},\"capacity\":15,"
                "\"customers\":[{\"id\":1,\"x\":20,\"y\":30,\"demand\":5},"
                "{\"id\":2,\"x\":60,\"y\":20,\"demand\":8},"
                "{\"id\":3,\"x\":80,\"y\":70,\"demand\":4},"
                "{\"id\":4,\"x\":30,\"y\":80,\"demand\":6}]}");
        } else {
            status = "404 Not Found";
            body = errorJson("Use GET or POST /api/optimize.");
        }

        string response =
            "HTTP/1.1 " + status + "\r\n"
            "Content-Type: " + contentType + "\r\n"
            "Access-Control-Allow-Origin: *\r\n"
            "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
            "Access-Control-Allow-Headers: Content-Type\r\n"
            "Connection: close\r\n"
            "Content-Length: " + to_string(body.size()) +
            "\r\n\r\n" + body;

        send(client, response.c_str(), (int)response.size(), 0);
        closesocket(client);
    }

    closesocket(server);
    WSACleanup();
    return 0;
}