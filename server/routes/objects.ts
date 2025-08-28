import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenancy";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "../objectStorage";

const router = Router();

// This endpoint is used to serve public objects.
router.get("/public-objects/:filePath(*)", async (req, res) => {
  const filePath = req.params.filePath;
  const objectStorageService = new ObjectStorageService();
  try {
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    objectStorageService.downloadObject(file, res);
  } catch (error) {
    console.error("Error searching for public object:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// This endpoint is used to serve private objects that can be accessed publicly
// (i.e.: without authentication and ACL check).
router.get("/objects/:objectPath(*)", async (req, res) => {
  const objectStorageService = new ObjectStorageService();
  try {
    const objectFile = await objectStorageService.getObjectEntityFile(
      req.path,
    );
    objectStorageService.downloadObject(objectFile, res);
  } catch (error) {
    console.error("Error checking object access:", error);
    if (error instanceof ObjectNotFoundError) {
      return res.sendStatus(404);
    }
    return res.sendStatus(500);
  }
});

// This endpoint is used to get the upload URL for an object entity.
router.post("/upload", requireAuth, async (req, res) => {
  const objectStorageService = new ObjectStorageService();
  const uploadURL = await objectStorageService.getObjectEntityUploadURL();
  res.json({ uploadURL });
});

// This endpoint converts a logo upload URL to object path and sets ACL
router.put("/logo", requireAuth, requireOrg, async (req, res) => {
  const { logoURL } = req.body;
  
  if (!logoURL) {
    return res.status(400).json({ error: "logoURL is required" });
  }

  try {
    const objectStorageService = new ObjectStorageService();
    const objectPath = objectStorageService.normalizeObjectEntityPath(logoURL);

    res.json({ objectPath });
  } catch (error) {
    console.error("Error setting logo path:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Diagnostic endpoint for logo issues
router.get("/diagnostics/:objectPath(*)", async (req, res) => {
  try {
    const fullPath = `/objects/${req.params.objectPath}`;
    const objectStorageService = new ObjectStorageService();
    
    let storageExists = false;
    let bytes = 0;
    let contentType = null;
    let storageError = null;
    let metadata = null;

    try {
      const objectFile = await objectStorageService.getObjectEntityFile(fullPath);
      const [fileMeta] = await objectFile.getMetadata();
      
      storageExists = true;
      bytes = parseInt(String(fileMeta.size || '0'));
      contentType = fileMeta.contentType;
      metadata = fileMeta;
      
    } catch (error: any) {
      storageError = error.message;
      if (error instanceof ObjectNotFoundError) {
        storageExists = false;
      }
    }

    res.json({
      requestedPath: fullPath,
      storage: {
        exists: storageExists,
        bytes,
        contentType,
        error: storageError,
        metadata: metadata
      },
      recommendations: [
        "Object path should be like /objects/uploads/<uuid>",
        "Check if object exists in Google Cloud Storage",
        "If bytes=0, re-upload the file",
        "Ensure proper ACL policy is set for public access"
      ]
    });
  } catch (error: any) {
    console.error("Diagnostic error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;