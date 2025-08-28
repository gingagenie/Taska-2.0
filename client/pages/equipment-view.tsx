import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { equipmentApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, MapPin, Calendar, User, Settings, FileText } from "lucide-react";
import { EquipmentModal } from "@/components/modals/equipment-modal";
import { useState } from "react";

export default function EquipmentView() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const { data: equipment, isLoading, error } = useQuery({
    queryKey: ["/api/equipment", id],
    queryFn: () => equipmentApi.get(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-xl border border-gray-200 animate-pulse">
          <div className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !equipment) {
    return (
      <div className="p-6">
        <Card className="border-equipment bg-white">
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">Equipment not found</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => navigate("/equipment")}
            >
              Back to Equipment
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 min-h-screen bg-gray-100">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => navigate("/equipment")}
          data-testid="button-back-equipment"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-equipment">{equipment.name || "Unnamed Equipment"}</h1>
          <p className="text-gray-600">Equipment Details</p>
        </div>
        <Button 
          onClick={() => setIsEditModalOpen(true)}
          data-testid="button-edit-equipment"
        >
          <Edit className="h-4 w-4 mr-1" />
          Edit
        </Button>
      </div>

      {/* Equipment Details */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Information */}
        <Card className="border-equipment bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Equipment Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Name</label>
              <p className="text-lg font-semibold">{equipment.name || "—"}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Make</label>
                <p className="font-medium">{equipment.make || "—"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Model</label>
                <p className="font-medium">{equipment.model || "—"}</p>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-500">Serial Number</label>
              <p className="font-medium font-mono text-sm bg-gray-50 px-2 py-1 rounded">
                {equipment.serial || "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Customer Assignment */}
        <Card className="border-equipment bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Assignment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {equipment.customer_name ? (
              <>
                <div>
                  <label className="text-sm font-medium text-gray-500">Assigned To</label>
                  <p className="text-lg font-semibold">{equipment.customer_name}</p>
                </div>
                
                {equipment.customer_address && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Location</label>
                    <p className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5 text-gray-400" />
                      <span>{equipment.customer_address}</span>
                    </p>
                  </div>
                )}
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(`/customers/${equipment.customer_id}`)}
                  data-testid="button-view-customer"
                >
                  View Customer
                </Button>
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-500 mb-4">Not assigned to any customer</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(`/equipment/${id}/edit`)}
                >
                  Assign Customer
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        {equipment.notes && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 whitespace-pre-wrap">{equipment.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Equipment History */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-l-2 border-blue-200 pl-4">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Calendar className="h-3 w-3" />
                  {equipment.updated_at && (
                    <span>Last updated {new Date(equipment.updated_at).toLocaleString()}</span>
                  )}
                </div>
                <p className="font-medium mt-1">Equipment record updated</p>
              </div>
              
              <div className="border-l-2 border-green-200 pl-4">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Calendar className="h-3 w-3" />
                  {equipment.created_at && (
                    <span>Created {new Date(equipment.created_at).toLocaleString()}</span>
                  )}
                </div>
                <p className="font-medium mt-1">Equipment added to system</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Edit Modal */}
      <EquipmentModal 
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        equipment={equipment}
        onSaved={() => {
          setIsEditModalOpen(false);
          // The modal will invalidate queries automatically
        }}
      />
    </div>
  );
}