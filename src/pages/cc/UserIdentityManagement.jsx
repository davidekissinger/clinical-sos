import React, { useState, useEffect, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { PageHeader, Badge, LoadingState, EmptyState } from "@/components/cc/ui";
import { ShieldCheck, Search, RefreshCw } from "lucide-react";
import IdentityDetailDialog from "@/components/cc/IdentityDetailDialog";

export default function UserIdentityManagement() {
  const [users, setUsers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, profilesRes, requestsRes] = await Promise.all([
        base44.entities.User.list("-created_date", 500),
        base44.entities.UserIdentityProfile.list("-created_date", 500),
        base44.entities.UserNameChangeRequest.filter({ request_status: "Pending" }),
      ]);
      setUsers(usersRes || []);
      setProfiles(profilesRes || []);
      setPendingRequests(requestsRes || []);
    } catch (err) {
      console.error("Failed to load identity data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const profileMap = useMemo(() => {
    const map = {};
    (profiles || []).forEach(p => { map[p.user_id] = p; });
    return map;
  }, [profiles]);

  const requestMap = useMemo(() => {
    const map = {};
    (pendingRequests || []).forEach(r => { map[r.requesting_user_id] = r; });
    return map;
  }, [pendingRequests]);

  const filteredUsers = useMemo(() => {
    return (users || []).filter(u => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (u.email || "").toLowerCase().includes(s) ||
             (u.full_name || "").toLowerCase().includes(s);
    });
  }, [users, search]);

  const stats = useMemo(() => ({
    total: users.length,
    profiles: profiles.length,
    verified: profiles.filter(p => p.identity_status === "Verified").length,
    pending: profiles.filter(p => p.identity_status === "Pending Verification").length,
    correction: profiles.filter(p => p.identity_status === "Correction Requested").length,
    suspended: profiles.filter(p => p.identity_status === "Suspended").length,
    retired: profiles.filter(p => p.identity_status === "Retired").length,
    pendingRequests: pendingRequests.length,
  }), [users, profiles, pendingRequests]);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="User Identity Management"
        subtitle="Administrator-controlled identity verification, display-name management, and credential oversight"
        action={
          <button onClick={loadAll} className="btn-secondary text-sm">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />

      {stats.pendingRequests > 0 && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/50 dark:border-amber-800 p-4 mb-6">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
            {stats.pendingRequests} pending name-change request(s) awaiting review.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Users" value={stats.total} />
        <StatCard label="Profiles Created" value={stats.profiles} />
        <StatCard label="Verified" value={stats.verified} tone="green" />
        <StatCard label="Pending Verification" value={stats.pending} tone="amber" />
        <StatCard label="Correction Requested" value={stats.correction} tone="amber" />
        <StatCard label="Suspended" value={stats.suspended} tone="red" />
        <StatCard label="Retired" value={stats.retired} tone="default" />
        <StatCard label="Pending Requests" value={stats.pendingRequests} tone="amber" />
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="cc-input pl-9"
            aria-label="Search users"
          />
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <EmptyState title="No users found" subtitle="Try adjusting your search." />
      ) : (
        <div className="bg-white dark:bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm cc-responsive-table">
              <thead className="bg-secondary/50 text-muted-foreground">
                <tr>
                  <th scope="col" className="text-left font-medium px-4 py-3 whitespace-nowrap">User</th>
                  <th scope="col" className="text-left font-medium px-4 py-3 whitespace-nowrap">Role</th>
                  <th scope="col" className="text-left font-medium px-4 py-3 whitespace-nowrap">Verified Name</th>
                  <th scope="col" className="text-left font-medium px-4 py-3 whitespace-nowrap">Status</th>
                  <th scope="col" className="text-left font-medium px-4 py-3 whitespace-nowrap">Pending Request</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map(u => {
                  const profile = profileMap[u.id];
                  const request = requestMap[u.id];
                  return (
                    <tr key={u.id} className="cursor-pointer hover:bg-secondary/30" onClick={() => setSelectedUser({ user: u, profile, request })}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{u.full_name || "(no provider name)"}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="px-4 py-3"><Badge tone="default">{u.role}</Badge></td>
                      <td className="px-4 py-3 text-foreground">
                        {profile?.verified_display_name ? (
                          <span>{profile.verified_display_name}{profile.verified_credentials ? `, ${profile.verified_credentials}` : ""}</span>
                        ) : (
                          <span className="text-muted-foreground italic">Not set</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {profile ? <StatusBadge status={profile.identity_status} /> : <Badge tone="default">No Profile</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        {request ? <Badge tone="amber">Pending</Badge> : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedUser && (
        <IdentityDetailDialog
          user={selectedUser.user}
          profile={selectedUser.profile}
          pendingRequest={selectedUser.request}
          onClose={() => setSelectedUser(null)}
          onChanged={loadAll}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, tone = "default" }) {
  const tones = { default: "text-foreground", green: "text-emerald-600 dark:text-emerald-400", amber: "text-amber-600 dark:text-amber-400", red: "text-rose-600 dark:text-rose-400" };
  return (
    <div className="bg-white dark:bg-card rounded-xl border border-border p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tones[tone]}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const tones = {
    "Verified": "green",
    "Pending Verification": "amber",
    "Correction Requested": "amber",
    "Suspended": "red",
    "Retired": "default",
  };
  return <Badge tone={tones[status] || "default"}>{status}</Badge>;
}