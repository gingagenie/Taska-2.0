import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireOrg } from '../middleware/tenancy';
import { xeroService } from '../services/xero';

interface AuthenticatedRequest extends Request {
  orgId: string;
}

interface XeroSession {
  xeroOrgId?: string;
}

const router = Router();

// Start OAuth2 flow
router.get('/connect', requireAuth, requireOrg, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const authUrl = await xeroService.getAuthUrl(req.orgId);
    
    // Store orgId in session for callback
    if (req.session) {
      (req.session as any).xeroOrgId = req.orgId;
    }
    
    res.json({ authUrl });
  } catch (error) {
    console.error('Xero connect error:', error);
    res.status(500).json({ error: 'Failed to initiate Xero connection' });
  }
});

// Handle OAuth2 callback
router.get('/callback', async (req: Request, res: Response) => {
  const { code } = req.query;
  
  // Get the correct base URL based on the request
  const protocol = req.get('X-Forwarded-Proto') || req.protocol;
  const host = req.get('Host');
  const baseUrl = `${protocol}://${host}`;
  
  if (!code || typeof code !== 'string') {
    return res.redirect(`${baseUrl}/settings?xero_error=invalid_code`);
  }

  try {
    // Get orgId from session
    const orgId = (req.session as any)?.xeroOrgId;
    if (!orgId) {
      return res.redirect(`${baseUrl}/settings?xero_error=session_expired`);
    }

    const result = await xeroService.handleCallback(code, orgId);
    
    // Clear session data
    if (req.session) {
      delete (req.session as any).xeroOrgId;
    }

    res.redirect(`${baseUrl}/settings?xero_success=true&tenant=${encodeURIComponent(result.tenantName)}`);
  } catch (error) {
    console.error('Xero callback error:', error);
    res.redirect(`${baseUrl}/settings?xero_error=connection_failed`);
  }
});

// Get integration status
router.get('/status', requireAuth, requireOrg, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const integration = await xeroService.getOrgIntegration(req.orgId);
    
    if (!integration) {
      return res.json({ connected: false });
    }

    res.json({
      connected: true,
      tenantName: integration.tenantName,
      connectedAt: integration.createdAt,
    });
  } catch (error) {
    console.error('Xero status error:', error);
    res.status(500).json({ error: 'Failed to check Xero status' });
  }
});

// Disconnect Xero integration
router.delete('/disconnect', requireAuth, requireOrg, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const integration = await xeroService.getOrgIntegration(req.orgId);
    
    if (integration) {
      await xeroService.disconnectIntegration(req.orgId);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Xero disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect Xero' });
  }
});

export default router;