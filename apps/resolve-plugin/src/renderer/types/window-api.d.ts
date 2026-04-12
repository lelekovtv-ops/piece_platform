export {};

declare global {
  interface Window {
    api?: {
      auth: {
        startSignIn: () => Promise<{
          userCode: string;
          deviceCode: string;
          verificationUri: string;
          expiresIn: number;
          interval: number;
        }>;
        getCurrentUser: () => Promise<{
          id: string;
          email: string;
          name?: string;
        } | null>;
        signOut: () => Promise<void>;
      };
      license: {
        check: () => Promise<{
          hasLicense: boolean;
          tier: string | null;
          expiresAt: string | null;
          stale: boolean;
        }>;
        refresh: () => Promise<{
          hasLicense: boolean;
          tier: string | null;
          expiresAt: string | null;
          stale: boolean;
        }>;
      };
      window: {
        expand: () => Promise<void>;
        collapse: () => Promise<void>;
        getMode: () => Promise<string>;
        hideTemporarily: () => Promise<void>;
        showAgain: () => Promise<void>;
        onModeChanged: (cb: (event: unknown, mode: "bubble" | "expanded") => void) => void;
      };
      generation: {
        run: (input: {
          providerId: string;
          prompt: string;
          apiKey: string;
          referenceImage?: string | null;
          duration?: number;
          referenceImages?: string[];
        }) => Promise<{ clipName: string; filePath?: string }>;
        cancel: () => Promise<void>;
        getStatus: () => Promise<string>;
        onProgress: (cb: (data: unknown) => void) => void;
        onComplete: (cb: (data: unknown) => void) => void;
        onError: (cb: (data: unknown) => void) => void;
      };
      snapshot: {
        capture: () => Promise<{ filePath: string }>;
      };
      keys: {
        get: (keyId: string) => Promise<string | null>;
        set: (keyId: string, value: string) => Promise<void>;
        remove: (keyId: string) => Promise<void>;
        list: () => Promise<string[]>;
      };
      library: {
        list: () => Promise<LibraryItem[]>;
        import: (filePath: string) => Promise<{ path: string }>;
        remove: (id: string) => Promise<void>;
        getUrl: (id: string) => Promise<string>;
      };
      queue: {
        add: (item: QueueAddInput) => Promise<QueueItem[]>;
        list: () => Promise<QueueItem[]>;
        cancel: (id: string) => Promise<QueueItem[]>;
        clear: () => Promise<QueueItem[]>;
        onUpdate: (cb: (items: QueueItem[]) => void) => void;
      };
    };
  }

  interface LibraryItem {
    id: string;
    name: string;
    path: string;
    type: "image" | "video" | "audio";
    url: string | null;
    createdAt: number;
    size: number;
  }

  interface QueueAddInput {
    providerId: string;
    prompt: string;
    apiKey: string;
    duration?: number;
    referenceImages?: string[];
  }

  interface QueueItem {
    id: string;
    providerId: string;
    prompt: string;
    apiKey: string;
    duration: number | null;
    referenceImages: string[];
    status: "pending" | "generating" | "done" | "error";
    result: { clipName: string; filePath: string } | null;
    error: string | null;
    createdAt: number;
  }
}
