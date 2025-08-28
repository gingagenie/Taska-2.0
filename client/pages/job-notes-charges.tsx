import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { notesApi, photosApi, api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Clock, Wrench } from "lucide-react";

export default function JobNotesCharges() {
  const [match, params] = useRoute("/jobs/:id/notes");
  const jobId = params?.id as string;

  const [notes, setNotes] = useState<any[]>([]);
  const [hours, setHours] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  
  const [newNote, setNewNote] = useState("");
  const [selectedHours, setSelectedHours] = useState("0.5");
  const [hoursDescription, setHoursDescription] = useState("");
  const [newPartName, setNewPartName] = useState("");
  const [newPartQuantity, setNewPartQuantity] = useState("1");
  
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [addingHours, setAddingHours] = useState(false);
  const [addingPart, setAddingPart] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Hours options (0.5 to 8 hours in 0.5 increments)
  const hoursOptions = [];
  for (let i = 0.5; i <= 8; i += 0.5) {
    hoursOptions.push(i);
  }

  // Parts quantity options (1 to 10)
  const partQuantityOptions = Array.from({ length: 10 }, (_, i) => i + 1);

  const loadAll = async () => {
    try {
      const [notesData, hoursData, partsData, photosData] = await Promise.all([
        notesApi.list(jobId),
        api(`/api/jobs/${jobId}/hours`),
        api(`/api/jobs/${jobId}/parts`),
        photosApi.list(jobId),
      ]);
      setNotes(notesData || []);
      setHours(hoursData || []);
      setParts(partsData || []);
      setPhotos(photosData || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (jobId) loadAll();
  }, [jobId]);

  const addNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    setErr(null);
    try {
      const note = await notesApi.add(jobId, newNote);
      setNotes(prev => [note, ...prev]);
      setNewNote("");
    } catch (e: any) {
      setErr(e?.message || "Failed to add note");
    } finally {
      setSavingNote(false);
    }
  };

  const addHours = async () => {
    setAddingHours(true);
    setErr(null);
    try {
      await api(`/api/jobs/${jobId}/hours`, {
        method: "POST",
        body: JSON.stringify({
          hours: parseFloat(selectedHours),
          description: hoursDescription.trim() || undefined,
        }),
      });
      // Refresh hours list
      const hoursData = await api(`/api/jobs/${jobId}/hours`);
      setHours(hoursData);
      setSelectedHours("0.5");
      setHoursDescription("");
    } catch (e: any) {
      setErr(e?.message || "Failed to add hours");
    } finally {
      setAddingHours(false);
    }
  };

  const addPart = async () => {
    if (!newPartName.trim()) return;
    setAddingPart(true);
    setErr(null);
    try {
      await api(`/api/jobs/${jobId}/parts`, {
        method: "POST",
        body: JSON.stringify({
          partName: newPartName.trim(),
          quantity: parseInt(newPartQuantity),
        }),
      });
      // Refresh parts list
      const partsData = await api(`/api/jobs/${jobId}/parts`);
      setParts(partsData);
      setNewPartName("");
      setNewPartQuantity("1");
    } catch (e: any) {
      setErr(e?.message || "Failed to add part");
    } finally {
      setAddingPart(false);
    }
  };




  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    setUploadingPhoto(true);
    setErr(null);
    try {
      // Upload files one by one since our API expects single file uploads
      for (const file of Array.from(files)) {
        const photo = await photosApi.upload(jobId, file);
        setPhotos(prev => [photo, ...prev]);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
      event.target.value = ""; // Reset file input
    }
  };

  const removePhoto = async (photoId: string) => {
    try {
      await photosApi.remove(jobId, photoId);
      setPhotos(prev => prev.filter(p => p.id !== photoId));
    } catch (e: any) {
      setErr(e?.message || "Failed to remove photo");
    }
  };



  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/jobs/${jobId}`}>
          <a><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></a>
        </Link>
        <h1 className="text-2xl font-bold">Notes & Hours + Parts</h1>
      </div>

      {err && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          {err}
        </div>
      )}

      {/* Notes section */}
      <Card>
        <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Enter work notes..."
              rows={3}
            />
            <Button onClick={addNote} disabled={savingNote || !newNote.trim()}>
              {savingNote ? "Adding..." : "Add Note"}
            </Button>
          </div>
          
          <div className="space-y-3">
            {notes.length === 0 ? (
              <p className="text-gray-500 text-sm">No notes yet</p>
            ) : (
              notes.map((note) => (
                <div key={note.id} className="bg-gray-50 p-3 rounded border">
                  <p className="text-sm whitespace-pre-wrap">{note.text}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(note.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Hours section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Hours Worked
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Hours</Label>
              <Select value={selectedHours} onValueChange={setSelectedHours}>
                <SelectTrigger>
                  <SelectValue placeholder="Select hours" />
                </SelectTrigger>
                <SelectContent>
                  {hoursOptions.map((hours) => (
                    <SelectItem key={hours} value={hours.toString()}>
                      {hours} {hours === 1 ? 'hour' : 'hours'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input
                value={hoursDescription}
                onChange={(e) => setHoursDescription(e.target.value)}
                placeholder="e.g., Installation, repair..."
              />
            </div>
          </div>
          
          <Button onClick={addHours} disabled={addingHours} className="w-full">
            {addingHours ? "Adding..." : "Add Hours"}
          </Button>

          <div className="space-y-2">
            {hours.length === 0 ? (
              <p className="text-gray-500 text-sm">No hours logged yet</p>
            ) : (
              <>
                {hours.map((hour) => (
                  <div key={hour.id} className="flex items-center justify-between border rounded p-3">
                    <div>
                      <div className="font-medium">{hour.hours} {hour.hours === 1 ? 'hour' : 'hours'}</div>
                      {hour.description && (
                        <div className="text-sm text-gray-600">{hour.description}</div>
                      )}
                      <div className="text-xs text-gray-500">
                        {new Date(hour.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-2 mt-2">
                  <div className="font-semibold">Total Hours</div>
                  <div className="font-bold">{hours.reduce((sum, h) => sum + h.hours, 0)} hours</div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Parts section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Parts Used
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Part Name</Label>
              <Input
                value={newPartName}
                onChange={(e) => setNewPartName(e.target.value)}
                placeholder="e.g., Air Filter, Exhaust"
              />
            </div>
            <div>
              <Label>Quantity</Label>
              <Select value={newPartQuantity} onValueChange={setNewPartQuantity}>
                <SelectTrigger>
                  <SelectValue placeholder="Qty" />
                </SelectTrigger>
                <SelectContent>
                  {partQuantityOptions.map((qty) => (
                    <SelectItem key={qty} value={qty.toString()}>
                      {qty}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Button 
            onClick={addPart} 
            disabled={addingPart || !newPartName.trim()} 
            className="w-full"
          >
            {addingPart ? "Adding..." : "Add Part"}
          </Button>

          <div className="space-y-2">
            {parts.length === 0 ? (
              <p className="text-gray-500 text-sm">No parts used yet</p>
            ) : (
              parts.map((part) => (
                <div key={part.id} className="flex items-center justify-between border rounded p-3">
                  <div>
                    <div className="font-medium">{part.part_name}</div>
                    <div className="text-sm text-gray-600">Quantity: {part.quantity}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(part.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Photos section */}
      <Card>
        <CardHeader><CardTitle>Photos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="photo-upload">Upload Photos</Label>
            <Input
              id="photo-upload"
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              disabled={uploadingPhoto}
            />
            {uploadingPhoto && <p className="text-sm text-gray-500 mt-1">Uploading...</p>}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="relative group">
                <img
                  src={photo.url}
                  alt="Job photo"
                  className="rounded border object-cover w-full h-40"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 h-6 w-6"
                  onClick={() => removePhoto(photo.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          {photos.length === 0 && (
            <p className="text-gray-500 text-sm">No photos yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}