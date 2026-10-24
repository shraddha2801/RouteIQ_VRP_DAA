
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

struct Saving {
    double value;
    int i, j;
};

double distanceBetween(const Customer& a, const Customer& b) {
    return hypot(a.x - b.x, a.y - b.y);
}

double routeDistance(const vector<int>& route,
                     const vector<vector<double>>& dist) {
    double total = 0;
    for (int i = 0; i + 1 < (int)route.size(); ++i)
        total += dist[route[i]][route[i + 1]];
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

    // 1. Precompute all pairwise distances.
    vector<vector<double>> dist(n, vector<double>(n, 0.0));

    for (int i = 0; i < n; ++i) {
        for (int j = i + 1; j < n; ++j) {
            dist[i][j] = dist[j][i] =
                distanceBetween(customers[i], customers[j]);
        }
    }

    // 2. Calculate savings for every customer pair.
    vector<Saving> savings;
    savings.reserve(n * (n - 1) / 2);

    for (int i = 1; i < n; ++i) {
        for (int j = i + 1; j < n; ++j) {
            double s = dist[0][i] + dist[0][j] - dist[i][j];
            savings.push_back({s, i, j});
        }
    }

    // 3. Sort savings from largest to smallest.
    sort(savings.begin(), savings.end(),
         [](const Saving& a, const Saving& b) {
             if (a.value != b.value)
                 return a.value > b.value;
             if (a.i != b.i)
                 return a.i < b.i;
             return a.j < b.j;
         });

    // 4. Initially, each customer has its own route.
    vector<vector<int>> routes(n);
    vector<int> routeLoad(n, 0);
    vector<int> active(n, 1);
    vector<int> routeOf(n, -1);

    for (int i = 1; i < n; ++i) {
        routes[i - 1] = {0, i, 0};
        routeLoad[i - 1] = customers[i].demand;
        routeOf[i] = i - 1;
    }

    // 5. Merge routes using the sorted savings list.
    for (const Saving& s : savings) {
        int ri = routeOf[s.i];
        int rj = routeOf[s.j];

        if (ri == rj || !active[ri] || !active[rj])
            continue;

        auto& a = routes[ri];
        auto& b = routes[rj];

        bool iEndpoint = (a[1] == s.i ||
                          a[a.size() - 2] == s.i);
        bool jEndpoint = (b[1] == s.j ||
                          b[b.size() - 2] == s.j);

        if (!iEndpoint || !jEndpoint)
            continue;

        if (routeLoad[ri] + routeLoad[rj] > capacity)
            continue;

        // Orient the routes so that i and j meet.
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

        // Keep ri; deactivate rj.
        routes[ri] = merged;
        routeLoad[ri] += routeLoad[rj];
        routeLoad[rj] = 0;
        active[rj] = 0;

        // Update the customer-to-route lookup.
        for (int c : merged) {
          if (c != 0)
                routeOf[c] = ri;
        }
    }

    // 6. Display final routes.
    double totalDistance = 0;
    int vehiclesUsed = 0;

    cout << fixed << setprecision(2);
    cout << "\nOPTIMIZED CLARKE-WRIGHT ALGORITHM\n";
    cout << "--------------------------------\n";

    

    for (int i = 0; i < n; ++i) {
        if (!active[i] || routes[i].size() <= 2)
            continue;

        ++vehiclesUsed;

        cout << "Vehicle " << vehiclesUsed << ": ";

        for (int j = 0; j < (int)routes[i].size(); ++j) {
            cout << routes[i][j];

            if (j + 1 < (int)routes[i].size())
                cout << " -> ";
        }

        double d = routeDistance(routes[i], dist);
        totalDistance += d;

        cout << "\nLoad: " << routeLoad[i] << "/" << capacity;
        cout << "\nRoute distance: " << d << "\n\n";
    }

    cout << "Vehicles used: " << vehiclesUsed << "\n";
    cout << "Total distance: " << totalDistance << "\n";

    return 0;
}

