import type { Request, Response, NextFunction } from "express";

function header(req: Request, name: string): string | undefined {
  return (req.headers[name.toLowerCase()] as string | undefined) || undefined;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Support dev headers for backward compatibility
  const hUser =
    header(req, "x-user-id") ||
    header(req, "x-userid") ||
    header(req, "x-user") ||
    (req.query.userId as string | undefined);

  if (hUser) {
    (req as any).user = { id: hUser };
    return next();
  }

  // Check session auth
  const userId = req.session.userId;
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  (req as any).user = { id: userId };
  next();
}
