
#include <iostream>
#include <vector>
#include <cmath>
#include <iomanip>
#include <algorithm>
using namespace std;

struct Customer {
    int id;
    double x, y;
    int demand;
};

double distanceBetween(const Customer& a, const Customer& b) {
    double dx = a.x - b.x;
    double dy = a.y - b.y;
    return sqrt(dx * dx + dy * dy);
}

double routeDistance(
    const vector<int>& route,
    const vector<vector<double>>& dist
) {
    double total = 0;
    for (int i = 0; i + 1 < (int)route.size(); i++) {
        total += dist[route[i]][route[i + 1]];
    }
    return total;
}

int main() {
    vector<Customer> customers = {
        {0, 50, 50, 0},
        {1, 20, 30, 5},
        {2, 60, 20, 8},
        {3, 80, 70, 4},
        {4, 30, 80, 6}
    };

    int capacity = 15;
    int n = (int)customers.size();

    // STEP 1: Precompute distance matrix
    vector<vector<double>> dist(n, vector<double>(n, 0));

    for (int i = 0; i < n; i++) {
        for (int j = i + 1; j < n; j++) {
            dist[i][j] = dist[j][i] =
                distanceBetween(customers[i], customers[j]);
        }
    }

    // STEP 2: Calculate savings
    struct Saving {
        double value;
        int i, j;
    };

    vector<Saving> savings;

    for (int i = 1; i < n; i++) {
        for (int j = i + 1; j < n; j++) {
            double saving =
                dist[0][i] + dist[0][j] - dist[i][j];

            savings.push_back({saving, i, j});
        }
    }

    // STEP 3: Sort savings in descending order
    sort(savings.begin(), savings.end(),
         [](const Saving& a, const Saving& b) {
             return a.value > b.value;
         });

    // STEP 4: Start with one route per customer
    vector<vector<int>> routes;

    for (int i = 1; i < n; i++) {
        routes.push_back({0, i, 0});
    }

    // STEP 5: Merge compatible routes
    for (const auto& s : savings) {
        int ri = -1, rj = -1;

        for (int k = 0; k < (int)routes.size(); k++) {
            for (int c : routes[k]) {
                if (c == s.i) ri = k;
                if (c == s.j) rj = k;
            }
        }

        if (ri == -1 || rj == -1 || ri == rj)
            continue;

        auto& a = routes[ri];
        auto& b = routes[rj];

        // Both customers must be route endpoints
        bool iEndpoint = (a[1] == s.i ||
                          a[a.size() - 2] == s.i);

        bool jEndpoint = (b[1] == s.j ||
                          b[b.size() - 2] == s.j);

        if (!iEndpoint || !jEndpoint)
            continue;

        int loadA = 0, loadB = 0;

        for (int c : a)
            if (c != 0) loadA += customers[c].demand;

        for (int c : b)
            if (c != 0) loadB += customers[c].demand;

        if (loadA + loadB > capacity)
            continue;

        vector<int> left(a.begin() + 1, a.end() - 1);
        vector<int> right(b.begin() + 1, b.end() - 1);

        if (left.front() != s.i)
            reverse(left.begin(), left.end());

        if (right.back() != s.j)
            reverse(right.begin(), right.end());

        vector<int> merged = {0};
        merged.insert(merged.end(), left.begin(), left.end());
        merged.insert(merged.end(), right.begin(), right.end());
        merged.push_back(0);

        routes[ri] = merged;
        routes.erase(routes.begin() + rj);
    }

    // STEP 6: Display routes and total distance
    double total = 0;

    cout << fixed << setprecision(2);
    cout << "\nCLARKE-WRIGHT SAVINGS ALGORITHM\n";
    cout << "------------------------------\n";

    for (int i = 0; i < (int)routes.size(); i++) {
        cout << "Vehicle " << i + 1 << ": ";

        for (int j = 0; j < (int)routes[i].size(); j++) {
            cout << routes[i][j];
            if (j + 1 < (int)routes[i].size())
                cout << " -> ";
        }

        double d = routeDistance(routes[i], dist);
        total += d;

        cout << "\nRoute distance: " << d << "\n\n";
    }

    cout << "Vehicles used: " << routes.size() << "\n";
    cout << "Total distance: " << total << "\n";

    return 0;
}
