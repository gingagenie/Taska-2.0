import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { teamsApi } from "@/lib/api";
import { UsersRound, Users } from "lucide-react";

export default function Teams() {
  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["/api/teams"],
    queryFn: teamsApi.getAll,
  });

  const getInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  const getBackgroundColor = (index: number) => {
    const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-red-500", "bg-orange-500", "bg-teal-500"];
    return colors[index % colors.length];
  };

  // Mock team members for display since the backend doesn't return member details
  const mockMembers = [
    { id: "1", name: "Mike Johnson", role: "Senior Technician", team: "Alpha Team", initials: "MJ", jobs: 4 },
    { id: "2", name: "Sarah Wilson", role: "Electrician", team: "Alpha Team", initials: "SW", jobs: 3 },
    { id: "3", name: "Bob Roberts", role: "HVAC Specialist", team: "Alpha Team", initials: "BR", jobs: 2 },
    { id: "4", name: "John Davis", role: "Plumber", team: "Beta Team", initials: "JD", jobs: 5 },
    { id: "5", name: "Amy Lee", role: "Technician", team: "Beta Team", initials: "AL", jobs: 3 },
  ];

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 animate-pulse">
              <div className="h-64"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        
        {/* Teams List */}
        <Card>
          <CardHeader>
            <CardTitle>Teams</CardTitle>
          </CardHeader>
          <CardContent>
            {teams.length === 0 ? (
              <div className="text-center py-8">
                <UsersRound className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No teams found</h3>
                <p className="mt-1 text-sm text-gray-500">Teams will appear here once they are created.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {teams.map((team: any, index: number) => (
                  <div key={team.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-900">{team.name}</h4>
                      <span className="text-sm text-gray-500">
                        {mockMembers.filter(m => m.team === team.name).length} members
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      {mockMembers
                        .filter(member => member.team === team.name)
                        .slice(0, 3)
                        .map((member, memberIndex) => (
                          <div key={member.id} className={`w-8 h-8 ${getBackgroundColor(memberIndex)} rounded-full flex items-center justify-center`}>
                            <span className="text-white text-xs font-medium">{member.initials}</span>
                          </div>
                        ))}
                      {mockMembers.filter(m => m.team === team.name).length > 3 && (
                        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                          <span className="text-gray-600 text-xs">
                            +{mockMembers.filter(m => m.team === team.name).length - 3}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        {mockMembers.filter(m => m.team === team.name).reduce((sum, m) => sum + m.jobs, 0)} active jobs
                      </span>
                      <Button variant="ghost" size="sm" className="text-primary hover:text-blue-700 font-medium">
                        Manage
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Team Members */}
        <Card>
          <CardHeader>
            <CardTitle>All Team Members</CardTitle>
          </CardHeader>
          <CardContent>
            {mockMembers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No team members found</h3>
                <p className="mt-1 text-sm text-gray-500">Add team members to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {mockMembers.map((member, index) => (
                  <div key={member.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${getBackgroundColor(index)} rounded-full flex items-center justify-center`}>
                        <span className="text-white text-sm font-medium">{member.initials}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{member.name}</p>
                        <p className="text-sm text-gray-500">{member.role} • {member.team}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{member.jobs} jobs</p>
                      <p className="text-xs text-gray-500">This week</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
      </div>
    </div>
  );
}
