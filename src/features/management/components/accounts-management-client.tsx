'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, ExternalLink, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import type {
  ManagedAccountBindingSummary,
  ManagedAccountDetail,
  ManagedAccountKeySummary,
  ManagedAccountSecuritySummary,
  ManagedAccountSummary,
  ManagedPlatformSummary,
  ManagedRegistrationSourceSummary,
  ManagedWealthEntry,
  PaginationMeta
} from '@/lib/platform/types';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { ManagementPagination } from './management-pagination';
import {
  buildPathWithQuery,
  getErrorMessage,
  requestJson
} from '../lib/client';
import {
  getAccountAttributeLabel,
  getAccountConfidenceLabel,
  getAccountStatusLabel,
  getPlatformRegionLabel,
  getSecurityTypeLabel
} from '../lib/display';

interface AccountsManagementClientProps {
  initialAccounts: ManagedAccountSummary[];
  initialPagination: PaginationMeta;
  initialPlatforms: ManagedPlatformSummary[];
  initialRegistrationSources: ManagedRegistrationSourceSummary[];
  workspaceId?: string;
  access: {
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
  };
}

type AccountFormState = {
  platformId: string;
  account: string;
  attribute: ManagedAccountSummary['attribute'];
  confidence: ManagedAccountSummary['confidence'];
  password: string;
  registeredAt: string;
  status: ManagedAccountSummary['status'];
};

type PlatformFormState = {
  name: string;
  url: string;
  iconUrl: string;
  region: ManagedPlatformSummary['region'];
};

type RegistrationSourceFormState = {
  name: string;
  code: string;
  website: string;
  remark: string;
};

type KeyFormState = {
  title: string;
  content: string;
  expiresAt: string;
};

type BindingFormState = {
  platformId: string;
  platformAccount: string;
};

type SecurityFormState = {
  securityType: ManagedAccountSecuritySummary['securityType'];
  content: string;
};

type WealthFormState = {
  key: string;
  value: string;
};

type ActiveSheet =
  | { type: 'closed' }
  | { type: 'account-editor'; accountId?: number }
  | { type: 'platforms'; accountId?: number }
  | { type: 'keys'; accountId: number }
  | { type: 'bindings'; accountId: number }
  | { type: 'sources'; accountId?: number }
  | { type: 'securities'; accountId: number }
  | { type: 'wealth'; accountId: number };

type DeleteTarget = null | {
  type:
    | 'account'
    | 'platform'
    | 'source'
    | 'key'
    | 'binding'
    | 'security'
    | 'wealth';
  ids: number[];
  label: string;
};

function createDefaultAccountForm(): AccountFormState {
  return {
    platformId: '',
    account: '',
    attribute: 'self_hosted',
    confidence: 'medium',
    password: '',
    registeredAt: '',
    status: 'available'
  };
}

function createDefaultPlatformForm(): PlatformFormState {
  return {
    name: '',
    url: '',
    iconUrl: '',
    region: 'mainland'
  };
}

function createDefaultRegistrationSourceForm(): RegistrationSourceFormState {
  return {
    name: '',
    code: '',
    website: '',
    remark: ''
  };
}

function createDefaultKeyForm(): KeyFormState {
  return {
    title: '',
    content: '',
    expiresAt: ''
  };
}

function createDefaultBindingForm(): BindingFormState {
  return {
    platformId: '',
    platformAccount: ''
  };
}

function createDefaultSecurityForm(): SecurityFormState {
  return {
    securityType: 'question',
    content: ''
  };
}

function createDefaultWealthForm(): WealthFormState {
  return {
    key: '',
    value: ''
  };
}

function createEmptyWealthEntries(): ManagedWealthEntry[] {
  return [];
}

function formatDateTimeLabel(value?: string | null) {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('zh-CN');
}

function toDateTimeLocalValue(value?: string | null) {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const localDate = new Date(
    parsed.getTime() - parsed.getTimezoneOffset() * 60000
  );
  return localDate.toISOString().slice(0, 16);
}

function ActionLinkButton({
  children,
  disabled,
  onClick
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type='button'
      disabled={disabled}
      onClick={onClick}
      className='text-primary underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50'
    >
      {children}
    </button>
  );
}

function PlatformIcon({
  iconUrl,
  name
}: {
  iconUrl?: string | null;
  name?: string | null;
}) {
  return iconUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={iconUrl}
      alt={name || 'platform icon'}
      className='size-8 shrink-0 rounded-lg border object-cover'
    />
  ) : (
    <div className='bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border text-xs'>
      {name?.slice(0, 1) || '?'}
    </div>
  );
}

export function AccountsManagementClient({
  initialAccounts,
  initialPagination,
  initialPlatforms,
  initialRegistrationSources,
  workspaceId,
  access
}: AccountsManagementClientProps) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [pagination, setPagination] = useState(initialPagination);
  const [platforms, setPlatforms] = useState(initialPlatforms);
  const [registrationSources, setRegistrationSources] = useState(
    initialRegistrationSources
  );
  const [page, setPage] = useState(initialPagination.page);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | ManagedAccountSummary['status']
  >('all');
  const [attributeFilter, setAttributeFilter] = useState<
    'all' | ManagedAccountSummary['attribute']
  >('all');
  const [confidenceFilter, setConfidenceFilter] = useState<
    'all' | ManagedAccountSummary['confidence']
  >('all');
  const [listPending, setListPending] = useState(false);
  const [sheetPending, setSheetPending] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>({
    type: 'closed'
  });
  const [selectedAccountDetail, setSelectedAccountDetail] =
    useState<ManagedAccountDetail | null>(null);
  const [accountForm, setAccountForm] = useState<AccountFormState>(
    createDefaultAccountForm()
  );
  const [platformForm, setPlatformForm] = useState<PlatformFormState>(
    createDefaultPlatformForm()
  );
  const [registrationSourceForm, setRegistrationSourceForm] =
    useState<RegistrationSourceFormState>(
      createDefaultRegistrationSourceForm()
    );
  const [editingSourceId, setEditingSourceId] = useState<number | null>(null);
  const [keyForm, setKeyForm] = useState<KeyFormState>(createDefaultKeyForm());
  const [editingKeyId, setEditingKeyId] = useState<number | null>(null);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [bindingForm, setBindingForm] = useState<BindingFormState>(
    createDefaultBindingForm()
  );
  const [bindingDrafts, setBindingDrafts] = useState<BindingFormState[]>([
    createDefaultBindingForm()
  ]);
  const [editingBindingId, setEditingBindingId] = useState<number | null>(null);
  const [securityForm, setSecurityForm] = useState<SecurityFormState>(
    createDefaultSecurityForm()
  );
  const [editingSecurityId, setEditingSecurityId] = useState<number | null>(
    null
  );
  const [securityDialogOpen, setSecurityDialogOpen] = useState(false);
  const [wealthForm, setWealthForm] = useState<WealthFormState>(
    createDefaultWealthForm()
  );
  const [editingWealthIndex, setEditingWealthIndex] = useState<number | null>(
    null
  );
  const [wealthDialogOpen, setWealthDialogOpen] = useState(false);
  const [selectedSourceIds, setSelectedSourceIds] = useState<number[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<number[]>([]);
  const [selectedCatalogSourceIds, setSelectedCatalogSourceIds] = useState<
    number[]
  >([]);
  const [selectedKeyIds, setSelectedKeyIds] = useState<number[]>([]);
  const [selectedSecurityIds, setSelectedSecurityIds] = useState<number[]>([]);
  const [selectedWealthIndices, setSelectedWealthIndices] = useState<number[]>(
    []
  );
  const [wealthDrafts, setWealthDrafts] = useState<ManagedWealthEntry[]>(
    createEmptyWealthEntries()
  );
  const [keySearchDraft, setKeySearchDraft] = useState('');
  const [keySearchKeyword, setKeySearchKeyword] = useState('');
  const [securitySearchDraft, setSecuritySearchDraft] = useState('');
  const [securitySearchKeyword, setSecuritySearchKeyword] = useState('');
  const [wealthSearchDraft, setWealthSearchDraft] = useState('');
  const [wealthSearchKeyword, setWealthSearchKeyword] = useState('');
  const [platformSearchDraft, setPlatformSearchDraft] = useState('');
  const [platformSearchKeyword, setPlatformSearchKeyword] = useState('');
  const [sourceSearchDraft, setSourceSearchDraft] = useState('');
  const [sourceSearchKeyword, setSourceSearchKeyword] = useState('');
  const [platformDialogOpen, setPlatformDialogOpen] = useState(false);
  const [platformEditingId, setPlatformEditingId] = useState<number | null>(
    null
  );
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [wideSheetWidth, setWideSheetWidth] = useState(1080);
  const [resizingWideSheet, setResizingWideSheet] = useState(false);
  const canManageNested = access.canCreate || access.canUpdate;
  const accountDialogOpen = activeSheet.type === 'account-editor';
  const sheetOpen =
    activeSheet.type !== 'closed' && activeSheet.type !== 'account-editor';
  const wideSheetActive =
    activeSheet.type === 'platforms' ||
    activeSheet.type === 'sources' ||
    activeSheet.type === 'keys' ||
    activeSheet.type === 'securities' ||
    activeSheet.type === 'wealth';
  const toolbarButtonClassName =
    'h-10 rounded-xl px-4 focus-visible:bg-white focus-visible:text-black active:bg-white active:text-black';
  const dialogFieldClassName = 'h-11 rounded-xl px-4';
  const dialogSectionClassName =
    'rounded-2xl border border-border/60 bg-background/40 p-5';
  const statusTriggerLabel =
    statusFilter === 'all' ? '状态' : getAccountStatusLabel(statusFilter);
  const attributeTriggerLabel =
    attributeFilter === 'all'
      ? '属性'
      : getAccountAttributeLabel(attributeFilter);
  const confidenceTriggerLabel =
    confidenceFilter === 'all'
      ? '置信度'
      : getAccountConfidenceLabel(confidenceFilter);
  const allAccountsSelected =
    accounts.length > 0 &&
    accounts.every((account) => selectedAccountIds.includes(account.id));

  const filteredPlatforms = useMemo(() => {
    const keyword = platformSearchKeyword.trim().toLowerCase();

    if (!keyword) {
      return platforms;
    }

    return platforms.filter((platform) =>
      [platform.name, platform.url].some((value) =>
        value.toLowerCase().includes(keyword)
      )
    );
  }, [platformSearchKeyword, platforms]);

  const filteredRegistrationSources = useMemo(() => {
    const keyword = sourceSearchKeyword.trim().toLowerCase();

    if (!keyword) {
      return registrationSources;
    }

    return registrationSources.filter((source) =>
      [
        source.name,
        source.code,
        source.website ?? '',
        source.remark ?? ''
      ].some((value) => value.toLowerCase().includes(keyword))
    );
  }, [registrationSources, sourceSearchKeyword]);

  const filteredKeys = useMemo(() => {
    const keyword = keySearchKeyword.trim().toLowerCase();
    const keys = selectedAccountDetail?.keys ?? [];

    if (!keyword) {
      return keys;
    }

    return keys.filter((key) =>
      [key.title, key.content, key.expiresAt ?? ''].some((value) =>
        value.toLowerCase().includes(keyword)
      )
    );
  }, [keySearchKeyword, selectedAccountDetail]);

  const filteredSecurities = useMemo(() => {
    const keyword = securitySearchKeyword.trim().toLowerCase();
    const securities = selectedAccountDetail?.securities ?? [];

    if (!keyword) {
      return securities;
    }

    return securities.filter((security) =>
      [
        getSecurityTypeLabel(security.securityType),
        security.content,
        security.updatedAt
      ].some((value) => value.toLowerCase().includes(keyword))
    );
  }, [securitySearchKeyword, selectedAccountDetail]);

  const filteredWealthEntries = useMemo(() => {
    const keyword = wealthSearchKeyword.trim().toLowerCase();
    const entries = wealthDrafts.map((entry, index) => ({ entry, index }));

    if (!keyword) {
      return entries;
    }

    return entries.filter(({ entry }) =>
      [entry.key, entry.value].some((value) =>
        value.toLowerCase().includes(keyword)
      )
    );
  }, [wealthDrafts, wealthSearchKeyword]);

  async function refreshAccounts() {
    if (!workspaceId) {
      return;
    }

    const data = await requestJson<{
      accounts: ManagedAccountSummary[];
      pagination: PaginationMeta;
    }>(
      buildPathWithQuery('/api/admin/accounts', {
        workspaceId,
        page,
        search: searchKeyword,
        status: statusFilter,
        attribute: attributeFilter,
        confidence: confidenceFilter
      })
    );

    setAccounts(data.accounts);
    setPagination(data.pagination);
    if (data.pagination.page !== page) {
      setPage(data.pagination.page);
    }
  }

  async function refreshMeta() {
    if (!workspaceId) {
      return;
    }

    const [platformResponse, sourceResponse] = await Promise.all([
      requestJson<{ platforms: ManagedPlatformSummary[] }>(
        `/api/admin/accounts/platforms?workspaceId=${workspaceId}`
      ),
      requestJson<{ registrationSources: ManagedRegistrationSourceSummary[] }>(
        `/api/admin/accounts/registration-sources?workspaceId=${workspaceId}`
      )
    ]);

    setPlatforms(platformResponse.platforms);
    setRegistrationSources(sourceResponse.registrationSources);
  }

  async function fetchAccountDetail(accountId: number) {
    if (!workspaceId) {
      throw new Error('当前没有可操作的工作区。');
    }

    const data = await requestJson<{ account: ManagedAccountDetail }>(
      `/api/admin/accounts/${accountId}?workspaceId=${workspaceId}`
    );

    return data.account;
  }

  async function loadAccountDetail(accountId: number) {
    const detail = await fetchAccountDetail(accountId);
    setSelectedAccountDetail(detail);
    return detail;
  }

  function resetForms() {
    setAccountForm(createDefaultAccountForm());
    setPlatformForm(createDefaultPlatformForm());
    setRegistrationSourceForm(createDefaultRegistrationSourceForm());
    setEditingSourceId(null);
    setSourceDialogOpen(false);
    setKeyForm(createDefaultKeyForm());
    setEditingKeyId(null);
    setKeyDialogOpen(false);
    setBindingForm(createDefaultBindingForm());
    setBindingDrafts([createDefaultBindingForm()]);
    setEditingBindingId(null);
    setSecurityForm(createDefaultSecurityForm());
    setEditingSecurityId(null);
    setSecurityDialogOpen(false);
    setWealthForm(createDefaultWealthForm());
    setEditingWealthIndex(null);
    setWealthDialogOpen(false);
    setSelectedAccountIds([]);
    setSelectedSourceIds([]);
    setSelectedPlatformIds([]);
    setSelectedCatalogSourceIds([]);
    setSelectedKeyIds([]);
    setSelectedSecurityIds([]);
    setSelectedWealthIndices([]);
    setWealthDrafts(createEmptyWealthEntries());
    setKeySearchDraft('');
    setKeySearchKeyword('');
    setSecuritySearchDraft('');
    setSecuritySearchKeyword('');
    setWealthSearchDraft('');
    setWealthSearchKeyword('');
    setPlatformSearchDraft('');
    setPlatformSearchKeyword('');
    setSourceSearchDraft('');
    setSourceSearchKeyword('');
    setPlatformDialogOpen(false);
    setPlatformEditingId(null);
  }

  function closeSheet() {
    setActiveSheet({ type: 'closed' });
    setSelectedAccountDetail(null);
    resetForms();
  }

  useEffect(() => {
    if (!workspaceId) {
      return;
    }

    let cancelled = false;

    async function loadAccounts() {
      setListPending(true);

      try {
        const data = await requestJson<{
          accounts: ManagedAccountSummary[];
          pagination: PaginationMeta;
        }>(
          buildPathWithQuery('/api/admin/accounts', {
            workspaceId,
            page,
            search: searchKeyword,
            status: statusFilter,
            attribute: attributeFilter,
            confidence: confidenceFilter
          })
        );

        if (cancelled) {
          return;
        }

        setAccounts(data.accounts);
        setPagination(data.pagination);
        if (data.pagination.page !== page) {
          setPage(data.pagination.page);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setListPending(false);
        }
      }
    }

    void loadAccounts();

    return () => {
      cancelled = true;
    };
  }, [
    attributeFilter,
    confidenceFilter,
    page,
    searchKeyword,
    statusFilter,
    workspaceId
  ]);

  useEffect(() => {
    if (!resizingWideSheet) {
      return;
    }

    function handleMouseMove(event: MouseEvent) {
      const nextWidth = window.innerWidth - event.clientX;
      setWideSheetWidth(
        Math.min(window.innerWidth - 24, Math.max(680, nextWidth))
      );
    }

    function handleMouseUp() {
      setResizingWideSheet(false);
    }

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingWideSheet]);

  useEffect(() => {
    setSelectedAccountIds((current) =>
      current.filter((id) => accounts.some((account) => account.id === id))
    );
  }, [accounts]);

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchKeyword(searchDraft.trim());
    setPage(1);
  }

  async function openAccountEditor(account?: ManagedAccountSummary) {
    if (!workspaceId) {
      toast.error('当前没有可操作的工作区。');
      return;
    }

    resetForms();

    if (!account) {
      setSelectedAccountDetail(null);
      setActiveSheet({ type: 'account-editor' });
      return;
    }

    setSheetPending(true);
    setActiveSheet({ type: 'account-editor', accountId: account.id });

    try {
      const detail = await loadAccountDetail(account.id);
      setAccountForm({
        platformId: detail.platformId ? String(detail.platformId) : '',
        account: detail.account,
        attribute: detail.attribute,
        confidence: detail.confidence,
        password: '',
        registeredAt: toDateTimeLocalValue(detail.registeredAt),
        status: detail.status
      });
      setSelectedSourceIds(detail.registrationSourceIds);
      setWealthDrafts(
        detail.wealthEntries.length
          ? detail.wealthEntries
          : createEmptyWealthEntries()
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
      closeSheet();
    } finally {
      setSheetPending(false);
    }
  }

  function openPlatformDialog(platform?: ManagedPlatformSummary) {
    setPlatformForm(
      platform
        ? {
            name: platform.name,
            url: platform.url,
            iconUrl: platform.iconUrl,
            region: platform.region
          }
        : createDefaultPlatformForm()
    );
    setPlatformEditingId(platform?.id ?? null);
    setPlatformDialogOpen(true);
  }

  function openSourceDialog(source?: ManagedRegistrationSourceSummary) {
    if (source) {
      setEditingSourceId(source.id);
      setRegistrationSourceForm({
        name: source.name,
        code: source.code,
        website: source.website ?? '',
        remark: source.remark ?? ''
      });
    } else {
      setEditingSourceId(null);
      setRegistrationSourceForm(createDefaultRegistrationSourceForm());
    }

    setSourceDialogOpen(true);
  }

  function openKeyDialog(key?: ManagedAccountKeySummary) {
    if (key) {
      setEditingKeyId(key.id);
      setKeyForm({
        title: key.title,
        content: key.content,
        expiresAt: toDateTimeLocalValue(key.expiresAt)
      });
    } else {
      setEditingKeyId(null);
      setKeyForm(createDefaultKeyForm());
    }

    setKeyDialogOpen(true);
  }

  function openSecurityDialog(security?: ManagedAccountSecuritySummary) {
    if (security) {
      setEditingSecurityId(security.id);
      setSecurityForm({
        securityType: security.securityType,
        content: security.content
      });
    } else {
      setEditingSecurityId(null);
      setSecurityForm(createDefaultSecurityForm());
    }

    setSecurityDialogOpen(true);
  }

  function openWealthDialog(index?: number) {
    if (typeof index === 'number' && wealthDrafts[index]) {
      setEditingWealthIndex(index);
      setWealthForm({
        key: wealthDrafts[index].key,
        value: wealthDrafts[index].value
      });
    } else {
      setEditingWealthIndex(null);
      setWealthForm(createDefaultWealthForm());
    }

    setWealthDialogOpen(true);
  }

  async function openAccountSheet(
    sheetType:
      | 'platforms'
      | 'keys'
      | 'bindings'
      | 'sources'
      | 'securities'
      | 'wealth',
    account?: ManagedAccountSummary
  ) {
    resetForms();

    if (!account && !['platforms', 'sources'].includes(sheetType)) {
      return;
    }

    if (sheetType === 'platforms') {
      setActiveSheet({ type: 'platforms', accountId: account?.id });
    } else if (sheetType === 'sources') {
      setActiveSheet({ type: 'sources', accountId: account?.id });
    } else {
      setActiveSheet({ type: sheetType, accountId: account!.id });
    }

    if (!account) {
      return;
    }

    setSheetPending(true);

    try {
      const detail = await loadAccountDetail(account.id);
      if (sheetType === 'sources') {
        setSelectedSourceIds(detail.registrationSourceIds);
      }
      if (sheetType === 'wealth') {
        setWealthDrafts(
          detail.wealthEntries.length
            ? detail.wealthEntries
            : createEmptyWealthEntries()
        );
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
      closeSheet();
    } finally {
      setSheetPending(false);
    }
  }

  async function handleCopy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label}已复制。`);
    } catch (_error) {
      toast.error(`复制${label}失败，请检查浏览器权限。`);
    }
  }

  function buildAccountPayload(
    form: AccountFormState,
    detail?: ManagedAccountDetail | null
  ) {
    if (!workspaceId) {
      throw new Error('当前没有可操作的工作区。');
    }

    return {
      workspaceId,
      platformId: form.platformId ? Number(form.platformId) : null,
      account: form.account,
      attribute: form.attribute,
      confidence: form.confidence,
      password: form.password.trim() || null,
      registeredAt: form.registeredAt || null,
      status: form.status,
      wealthEntries: detail?.wealthEntries ?? [],
      sourceIds: detail?.registrationSourceIds ?? []
    };
  }

  async function handleAccountSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspaceId) {
      toast.error('当前没有可操作的工作区。');
      return;
    }

    setSubmitPending(true);

    try {
      if (
        activeSheet.type === 'account-editor' &&
        activeSheet.accountId &&
        !selectedAccountDetail
      ) {
        throw new Error('账号详情尚未加载完成，请稍后再试。');
      }

      const payload = buildAccountPayload(accountForm, selectedAccountDetail);

      if (activeSheet.type === 'account-editor' && activeSheet.accountId) {
        await requestJson(`/api/admin/accounts/${activeSheet.accountId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        toast.success('账号已更新。');
      } else {
        await requestJson('/api/admin/accounts', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        toast.success('账号已创建。');
      }

      await refreshAccounts();
      closeSheet();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitPending(false);
    }
  }

  async function handlePlatformSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspaceId) {
      toast.error('当前没有可操作的工作区。');
      return;
    }

    setSubmitPending(true);

    try {
      const payload = {
        workspaceId,
        name: platformForm.name,
        url: platformForm.url,
        iconUrl: platformForm.iconUrl || null,
        region: platformForm.region
      };

      if (platformEditingId) {
        await requestJson(
          `/api/admin/accounts/platforms/${platformEditingId}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload)
          }
        );
        toast.success('平台已更新。');
      } else {
        await requestJson('/api/admin/accounts/platforms', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        toast.success('平台已创建。');
      }

      await Promise.all([refreshMeta(), refreshAccounts()]);
      setPlatformDialogOpen(false);
      setPlatformEditingId(null);
      setPlatformForm(createDefaultPlatformForm());
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitPending(false);
    }
  }

  async function handleBindPrimaryPlatform(platformId: number) {
    if (
      !workspaceId ||
      activeSheet.type !== 'platforms' ||
      !activeSheet.accountId
    ) {
      return;
    }

    setSubmitPending(true);

    try {
      const data = await requestJson<{ account: ManagedAccountDetail }>(
        `/api/admin/accounts/${activeSheet.accountId}/platform`,
        {
          method: 'PUT',
          body: JSON.stringify({
            workspaceId,
            platformId
          })
        }
      );

      setSelectedAccountDetail(data.account);
      toast.success('主平台已绑定。');
      await refreshAccounts();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitPending(false);
    }
  }

  async function handleKeySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspaceId || !selectedAccountDetail) {
      return;
    }

    setSubmitPending(true);

    try {
      const payload = {
        title: keyForm.title,
        content: keyForm.content,
        expiresAt: keyForm.expiresAt || null
      };

      const data = editingKeyId
        ? await requestJson<{ account: ManagedAccountDetail }>(
            `/api/admin/accounts/keys/${editingKeyId}?workspaceId=${workspaceId}`,
            {
              method: 'PUT',
              body: JSON.stringify(payload)
            }
          )
        : await requestJson<{ account: ManagedAccountDetail }>(
            `/api/admin/accounts/${selectedAccountDetail.id}/keys?workspaceId=${workspaceId}`,
            {
              method: 'POST',
              body: JSON.stringify(payload)
            }
          );

      setSelectedAccountDetail(data.account);
      setKeyForm(createDefaultKeyForm());
      setEditingKeyId(null);
      setKeyDialogOpen(false);
      toast.success(editingKeyId ? '密钥已更新。' : '密钥已新增。');
      await refreshAccounts();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitPending(false);
    }
  }

  async function handleBindingSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspaceId || !selectedAccountDetail) {
      return;
    }

    setSubmitPending(true);

    try {
      let data: { account: ManagedAccountDetail };

      if (editingBindingId) {
        data = await requestJson<{ account: ManagedAccountDetail }>(
          `/api/admin/accounts/bindings/${editingBindingId}?workspaceId=${workspaceId}`,
          {
            method: 'PUT',
            body: JSON.stringify({
              platformId: bindingForm.platformId
                ? Number(bindingForm.platformId)
                : null,
              platformAccount: bindingForm.platformAccount
            })
          }
        );
      } else {
        const items = bindingDrafts
          .filter((item) => item.platformId && item.platformAccount.trim())
          .map((item) => ({
            platformId: Number(item.platformId),
            platformAccount: item.platformAccount
          }));

        data = await requestJson<{ account: ManagedAccountDetail }>(
          `/api/admin/accounts/${selectedAccountDetail.id}/bindings?workspaceId=${workspaceId}`,
          {
            method: 'POST',
            body: JSON.stringify({ items })
          }
        );
      }

      setSelectedAccountDetail(data.account);
      setBindingForm(createDefaultBindingForm());
      setBindingDrafts([createDefaultBindingForm()]);
      setEditingBindingId(null);
      toast.success(editingBindingId ? '绑定关系已更新。' : '绑定关系已新增。');
      await refreshAccounts();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitPending(false);
    }
  }

  async function handleSecuritySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspaceId || !selectedAccountDetail) {
      return;
    }

    setSubmitPending(true);

    try {
      const payload = {
        securityType: securityForm.securityType,
        content: securityForm.content
      };

      const data = editingSecurityId
        ? await requestJson<{ account: ManagedAccountDetail }>(
            `/api/admin/accounts/securities/${editingSecurityId}?workspaceId=${workspaceId}`,
            {
              method: 'PUT',
              body: JSON.stringify(payload)
            }
          )
        : await requestJson<{ account: ManagedAccountDetail }>(
            `/api/admin/accounts/${selectedAccountDetail.id}/securities?workspaceId=${workspaceId}`,
            {
              method: 'POST',
              body: JSON.stringify(payload)
            }
          );

      setSelectedAccountDetail(data.account);
      setSecurityForm(createDefaultSecurityForm());
      setEditingSecurityId(null);
      setSecurityDialogOpen(false);
      toast.success(editingSecurityId ? '密保已更新。' : '密保已新增。');
      await refreshAccounts();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitPending(false);
    }
  }

  async function handleSourceBindingToggle(
    sourceId: number,
    shouldBind: boolean
  ) {
    if (
      !workspaceId ||
      activeSheet.type !== 'sources' ||
      !activeSheet.accountId
    ) {
      return;
    }

    setSubmitPending(true);

    try {
      const nextSourceIds = shouldBind
        ? Array.from(new Set([...selectedSourceIds, sourceId]))
        : selectedSourceIds.filter((id) => id !== sourceId);

      const data = await requestJson<{ account: ManagedAccountDetail }>(
        `/api/admin/accounts/${activeSheet.accountId}/registration-sources?workspaceId=${workspaceId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            sourceIds: nextSourceIds
          })
        }
      );

      setSelectedAccountDetail(data.account);
      setSelectedSourceIds(data.account.registrationSourceIds);
      toast.success('注册源绑定已更新。');
      await refreshAccounts();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitPending(false);
    }
  }

  async function handleRegistrationSourceSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!workspaceId) {
      return;
    }

    setSubmitPending(true);

    try {
      const payload = {
        workspaceId,
        name: registrationSourceForm.name,
        code: registrationSourceForm.code,
        website: registrationSourceForm.website || null,
        remark: registrationSourceForm.remark || null
      };

      if (editingSourceId) {
        await requestJson(
          `/api/admin/accounts/registration-sources/${editingSourceId}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload)
          }
        );
        toast.success('注册源已更新。');
      } else {
        await requestJson('/api/admin/accounts/registration-sources', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        toast.success('注册源已创建。');
      }

      await refreshMeta();
      if (activeSheet.type === 'sources' && activeSheet.accountId) {
        const detail = await loadAccountDetail(activeSheet.accountId);
        setSelectedSourceIds(detail.registrationSourceIds);
      }
      setRegistrationSourceForm(createDefaultRegistrationSourceForm());
      setEditingSourceId(null);
      setSourceDialogOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitPending(false);
    }
  }

  async function saveWealthEntries(
    entries: ManagedWealthEntry[],
    successMessage: string
  ) {
    if (!workspaceId || !selectedAccountDetail) {
      return false;
    }

    setSubmitPending(true);

    try {
      const sanitizedEntries = entries.filter(
        (entry) => entry.key.trim() && entry.value.trim()
      );
      const data = await requestJson<{ account: ManagedAccountDetail }>(
        `/api/admin/accounts/${selectedAccountDetail.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            workspaceId,
            platformId: selectedAccountDetail.platformId,
            account: selectedAccountDetail.account,
            attribute: selectedAccountDetail.attribute,
            confidence: selectedAccountDetail.confidence,
            password: null,
            registeredAt:
              toDateTimeLocalValue(selectedAccountDetail.registeredAt) || null,
            status: selectedAccountDetail.status,
            wealthEntries: sanitizedEntries,
            sourceIds: selectedAccountDetail.registrationSourceIds
          })
        }
      );

      setSelectedAccountDetail(data.account);
      setWealthDrafts(data.account.wealthEntries);
      toast.success(successMessage);
      await refreshAccounts();
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error));
      return false;
    } finally {
      setSubmitPending(false);
    }
  }

  async function handleWealthEntrySubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!wealthForm.key.trim() || !wealthForm.value.trim()) {
      toast.error('请先填写完整的标题和内容。');
      return;
    }

    const nextEntry = {
      key: wealthForm.key,
      value: wealthForm.value
    };
    const nextEntries =
      editingWealthIndex === null
        ? [...wealthDrafts, nextEntry]
        : wealthDrafts.map((entry, index) =>
            index === editingWealthIndex ? nextEntry : entry
          );

    const success = await saveWealthEntries(
      nextEntries,
      editingWealthIndex === null ? '补充信息已新增。' : '补充信息已更新。'
    );

    if (success) {
      setWealthDialogOpen(false);
      setEditingWealthIndex(null);
      setWealthForm(createDefaultWealthForm());
      setSelectedWealthIndices([]);
    }
  }

  function beginEditBinding(binding: ManagedAccountBindingSummary) {
    setEditingBindingId(binding.id);
    setBindingForm({
      platformId: binding.platformId ? String(binding.platformId) : '',
      platformAccount: binding.platformAccount
    });
  }

  function toggleSelectedIds(
    current: number[],
    id: number,
    checked: boolean | 'indeterminate'
  ) {
    return checked
      ? Array.from(new Set([...current, id]))
      : current.filter((currentId) => currentId !== id);
  }

  async function handleDeleteConfirm() {
    if (!workspaceId || !deleteTarget) {
      return;
    }

    setDeletePending(true);

    try {
      switch (deleteTarget.type) {
        case 'account':
          await Promise.all(
            deleteTarget.ids.map((id) =>
              requestJson(
                `/api/admin/accounts/${id}?workspaceId=${workspaceId}`,
                {
                  method: 'DELETE'
                }
              )
            )
          );
          toast.success(
            deleteTarget.ids.length > 1 ? '账号已批量删除。' : '账号已删除。'
          );
          setSelectedAccountIds([]);
          closeSheet();
          break;
        case 'platform':
          await Promise.all(
            deleteTarget.ids.map((id) =>
              requestJson(
                `/api/admin/accounts/platforms/${id}?workspaceId=${workspaceId}`,
                { method: 'DELETE' }
              )
            )
          );
          toast.success(
            deleteTarget.ids.length > 1 ? '平台已批量删除。' : '平台已删除。'
          );
          if (
            platformEditingId &&
            deleteTarget.ids.includes(platformEditingId)
          ) {
            setPlatformDialogOpen(false);
            setPlatformEditingId(null);
            setPlatformForm(createDefaultPlatformForm());
          }
          setSelectedPlatformIds([]);
          break;
        case 'source':
          await Promise.all(
            deleteTarget.ids.map((id) =>
              requestJson(
                `/api/admin/accounts/registration-sources/${id}?workspaceId=${workspaceId}`,
                { method: 'DELETE' }
              )
            )
          );
          toast.success(
            deleteTarget.ids.length > 1
              ? '注册源已批量删除。'
              : '注册源已删除。'
          );
          setRegistrationSourceForm(createDefaultRegistrationSourceForm());
          setEditingSourceId(null);
          setSourceDialogOpen(false);
          setSelectedCatalogSourceIds([]);
          break;
        case 'key': {
          await Promise.all(
            deleteTarget.ids.map((id) =>
              requestJson(
                `/api/admin/accounts/keys/${id}?workspaceId=${workspaceId}`,
                {
                  method: 'DELETE'
                }
              )
            )
          );
          if (activeSheet.type === 'keys' && activeSheet.accountId) {
            const detail = await loadAccountDetail(activeSheet.accountId);
            setSelectedAccountDetail(detail);
          }
          setSelectedKeyIds([]);
          setKeyDialogOpen(false);
          setEditingKeyId(null);
          setKeyForm(createDefaultKeyForm());
          toast.success(
            deleteTarget.ids.length > 1 ? '密钥已批量删除。' : '密钥已删除。'
          );
          break;
        }
        case 'binding': {
          const data = await requestJson<{ account: ManagedAccountDetail }>(
            `/api/admin/accounts/bindings/${deleteTarget.ids[0]}?workspaceId=${workspaceId}`,
            { method: 'DELETE' }
          );
          setSelectedAccountDetail(data.account);
          toast.success('绑定关系已删除。');
          break;
        }
        case 'security': {
          await Promise.all(
            deleteTarget.ids.map((id) =>
              requestJson(
                `/api/admin/accounts/securities/${id}?workspaceId=${workspaceId}`,
                { method: 'DELETE' }
              )
            )
          );
          if (activeSheet.type === 'securities' && activeSheet.accountId) {
            const detail = await loadAccountDetail(activeSheet.accountId);
            setSelectedAccountDetail(detail);
          }
          setSelectedSecurityIds([]);
          setSecurityDialogOpen(false);
          setEditingSecurityId(null);
          setSecurityForm(createDefaultSecurityForm());
          toast.success(
            deleteTarget.ids.length > 1 ? '密保已批量删除。' : '密保已删除。'
          );
          break;
        }
        case 'wealth': {
          const nextEntries = wealthDrafts.filter(
            (_, index) => !deleteTarget.ids.includes(index)
          );
          const success = await saveWealthEntries(
            nextEntries,
            deleteTarget.ids.length > 1
              ? '补充信息已批量删除。'
              : '补充信息已删除。'
          );

          if (!success) {
            return;
          }

          setSelectedWealthIndices([]);
          setWealthDialogOpen(false);
          setEditingWealthIndex(null);
          setWealthForm(createDefaultWealthForm());
          break;
        }
      }

      await Promise.all([refreshAccounts(), refreshMeta()]);
      if (activeSheet.type === 'sources' && activeSheet.accountId) {
        const detail = await loadAccountDetail(activeSheet.accountId);
        setSelectedSourceIds(detail.registrationSourceIds);
      }
      setDeleteTarget(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletePending(false);
    }
  }

  function renderAccountDialogContent() {
    if (activeSheet.type !== 'account-editor') {
      return null;
    }

    const isEditingAccount = Boolean(activeSheet.accountId);
    const passwordHint = isEditingAccount
      ? '留空表示保持当前已加密密码。'
      : '可选，提交后会按 MD5 规则入库。';

    return (
      <DialogContent className='border-border/60 bg-background/95 overflow-hidden p-0 shadow-2xl sm:max-w-3xl'>
        <DialogHeader className='border-border/60 border-b px-6 pt-6 pb-4'>
          <DialogTitle>
            {isEditingAccount ? '编辑账号' : '新增账号'}
          </DialogTitle>
          <DialogDescription>
            账号主体在弹窗中维护基础字段，注册源与补充信息继续在对应详情列表中维护。
          </DialogDescription>
        </DialogHeader>

        {sheetPending ? (
          <div className='flex min-h-[360px] items-center justify-center px-6 py-12'>
            <Loader2 className='text-muted-foreground size-5 animate-spin' />
          </div>
        ) : (
          <form
            className='flex max-h-[calc(100vh-8rem)] flex-col'
            onSubmit={handleAccountSubmit}
          >
            <div className='space-y-5 overflow-y-auto px-6 pt-5 pb-5'>
              <section className={dialogSectionClassName}>
                <div className='space-y-1'>
                  <div className='text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase'>
                    基础信息
                  </div>
                  <div className='text-muted-foreground text-sm'>
                    先绑定主平台和账号主体，保持列表结构清晰可读。
                  </div>
                </div>

                <div className='mt-5 grid gap-5 md:grid-cols-2'>
                  <div className='grid gap-2'>
                    <div className='text-sm font-medium'>主平台</div>
                    <Select
                      value={accountForm.platformId || 'none'}
                      onValueChange={(value) =>
                        setAccountForm((current) => ({
                          ...current,
                          platformId: value === 'none' ? '' : value
                        }))
                      }
                    >
                      <SelectTrigger className={dialogFieldClassName}>
                        <SelectValue placeholder='请选择平台' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='none'>暂不绑定</SelectItem>
                        {platforms.map((platform) => (
                          <SelectItem
                            key={platform.id}
                            value={String(platform.id)}
                          >
                            {platform.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className='grid gap-2'>
                    <div className='text-sm font-medium'>账号</div>
                    <Input
                      value={accountForm.account}
                      onChange={(event) =>
                        setAccountForm((current) => ({
                          ...current,
                          account: event.target.value
                        }))
                      }
                      placeholder='请输入账号'
                      className={dialogFieldClassName}
                    />
                  </div>
                </div>

                <div className='mt-5 grid gap-5 md:grid-cols-2'>
                  <div className='grid gap-2'>
                    <div className='text-sm font-medium'>属性</div>
                    <Select
                      value={accountForm.attribute}
                      onValueChange={(
                        value: ManagedAccountSummary['attribute']
                      ) =>
                        setAccountForm((current) => ({
                          ...current,
                          attribute: value
                        }))
                      }
                    >
                      <SelectTrigger className={dialogFieldClassName}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='self_hosted'>自托管</SelectItem>
                        <SelectItem value='third_party'>三方</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className='grid gap-2'>
                    <div className='text-sm font-medium'>置信度</div>
                    <Select
                      value={accountForm.confidence}
                      onValueChange={(
                        value: ManagedAccountSummary['confidence']
                      ) =>
                        setAccountForm((current) => ({
                          ...current,
                          confidence: value
                        }))
                      }
                    >
                      <SelectTrigger className={dialogFieldClassName}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='very_high'>极高</SelectItem>
                        <SelectItem value='high'>高</SelectItem>
                        <SelectItem value='medium'>中</SelectItem>
                        <SelectItem value='low'>低</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              <section className={dialogSectionClassName}>
                <div className='space-y-1'>
                  <div className='text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase'>
                    状态与安全
                  </div>
                  <div className='text-muted-foreground text-sm'>
                    保持密码、状态和注册时间分区展示，避免字段贴边堆叠。
                  </div>
                </div>

                <div className='mt-5 grid gap-5 md:grid-cols-2'>
                  <div className='grid gap-2'>
                    <div className='text-sm font-medium'>密码</div>
                    <Input
                      type='password'
                      value={accountForm.password}
                      onChange={(event) =>
                        setAccountForm((current) => ({
                          ...current,
                          password: event.target.value
                        }))
                      }
                      placeholder={
                        isEditingAccount
                          ? '留空表示保持原密码'
                          : '可选，保存后按 MD5 入库'
                      }
                      className={dialogFieldClassName}
                    />
                    <div className='text-muted-foreground text-xs'>
                      {passwordHint}
                    </div>
                  </div>

                  <div className='grid gap-2'>
                    <div className='text-sm font-medium'>注册时间</div>
                    <Input
                      type='datetime-local'
                      value={accountForm.registeredAt}
                      onChange={(event) =>
                        setAccountForm((current) => ({
                          ...current,
                          registeredAt: event.target.value
                        }))
                      }
                      className={dialogFieldClassName}
                    />
                  </div>
                </div>

                <div className='mt-5 grid gap-2 md:max-w-[240px]'>
                  <div className='text-sm font-medium'>状态</div>
                  <Select
                    value={accountForm.status}
                    onValueChange={(value: ManagedAccountSummary['status']) =>
                      setAccountForm((current) => ({
                        ...current,
                        status: value
                      }))
                    }
                  >
                    <SelectTrigger className={dialogFieldClassName}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='available'>可用</SelectItem>
                      <SelectItem value='banned'>封禁</SelectItem>
                      <SelectItem value='cancelled'>已注销</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </section>
            </div>

            <DialogFooter className='border-border/60 border-t px-6 py-4'>
              <Button
                type='button'
                variant='outline'
                className='rounded-xl'
                onClick={closeSheet}
              >
                取消
              </Button>
              <Button
                type='submit'
                className='rounded-xl'
                disabled={submitPending}
              >
                {submitPending
                  ? '保存中...'
                  : isEditingAccount
                    ? '保存修改'
                    : '创建账号'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    );
  }

  function renderSheetContent() {
    if (sheetPending) {
      return (
        <div className='flex h-full items-center justify-center py-12'>
          <Loader2 className='text-muted-foreground size-5 animate-spin' />
        </div>
      );
    }

    switch (activeSheet.type) {
      case 'account-editor':
        return null;

      case 'platforms': {
        const allPlatformsSelected =
          filteredPlatforms.length > 0 &&
          filteredPlatforms.every((platform) =>
            selectedPlatformIds.includes(platform.id)
          );

        return (
          <>
            <SheetHeader className='border-border/60 border-b pb-4'>
              <SheetTitle>平台</SheetTitle>
            </SheetHeader>
            <div className='flex h-full min-h-0 flex-col px-4 pb-4'>
              <form
                className='border-border/60 flex flex-col gap-2 border-b py-4 lg:flex-row lg:items-center'
                onSubmit={(event) => {
                  event.preventDefault();
                  setPlatformSearchKeyword(platformSearchDraft.trim());
                }}
              >
                <Input
                  value={platformSearchDraft}
                  onChange={(event) => {
                    const value = event.target.value;
                    setPlatformSearchDraft(value);
                    if (!value.trim()) {
                      setPlatformSearchKeyword('');
                    }
                  }}
                  placeholder='搜索平台名称 / 平台地址'
                  className='h-10 flex-1 rounded-xl px-4'
                />
                <div className='flex flex-wrap items-center justify-end gap-2'>
                  <Button
                    type='submit'
                    variant='outline'
                    className={toolbarButtonClassName}
                    onMouseUp={(event) => event.currentTarget.blur()}
                  >
                    搜索
                  </Button>
                  {access.canCreate ? (
                    <Button
                      type='button'
                      variant='outline'
                      className={toolbarButtonClassName}
                      onClick={() => openPlatformDialog()}
                      onMouseUp={(event) => event.currentTarget.blur()}
                    >
                      新增
                    </Button>
                  ) : null}
                  {access.canDelete ? (
                    <Button
                      type='button'
                      variant='outline'
                      className={toolbarButtonClassName}
                      disabled={!selectedPlatformIds.length}
                      onClick={() =>
                        setDeleteTarget({
                          type: 'platform',
                          ids: selectedPlatformIds,
                          label:
                            selectedPlatformIds.length > 1
                              ? `已选 ${selectedPlatformIds.length} 个平台`
                              : platforms.find(
                                  (platform) =>
                                    platform.id === selectedPlatformIds[0]
                                )?.name || '当前平台'
                        })
                      }
                      onMouseUp={(event) => event.currentTarget.blur()}
                    >
                      删除
                    </Button>
                  ) : null}
                </div>
              </form>

              <div className='min-h-0 flex-1 overflow-auto py-4'>
                <Table className='min-w-[860px]'>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='w-12'>
                        <Checkbox
                          checked={
                            allPlatformsSelected
                              ? true
                              : selectedPlatformIds.length
                                ? 'indeterminate'
                                : false
                          }
                          onCheckedChange={(checked) =>
                            setSelectedPlatformIds(
                              checked
                                ? filteredPlatforms.map(
                                    (platform) => platform.id
                                  )
                                : []
                            )
                          }
                          aria-label='全选平台'
                        />
                      </TableHead>
                      <TableHead>平台</TableHead>
                      <TableHead>平台地址</TableHead>
                      <TableHead>网域性质</TableHead>
                      <TableHead className='w-[220px]'>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPlatforms.map((platform) => {
                      const isCurrent =
                        selectedAccountDetail?.platformId === platform.id;

                      return (
                        <TableRow key={platform.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedPlatformIds.includes(
                                platform.id
                              )}
                              onCheckedChange={(checked) =>
                                setSelectedPlatformIds((current) =>
                                  toggleSelectedIds(
                                    current,
                                    platform.id,
                                    checked
                                  )
                                )
                              }
                              aria-label={`选择平台 ${platform.name}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className='flex min-w-0 items-center gap-3'>
                              <PlatformIcon
                                iconUrl={platform.iconUrl}
                                name={platform.name}
                              />
                              <div className='min-w-0'>
                                <div className='truncate font-medium'>
                                  {platform.name}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className='max-w-md'>
                            <a
                              href={platform.url}
                              target='_blank'
                              rel='noreferrer'
                              className='text-muted-foreground inline-flex max-w-full items-center gap-1 truncate text-sm underline-offset-4 hover:underline'
                            >
                              <span className='truncate'>{platform.url}</span>
                              <ExternalLink className='size-4 shrink-0' />
                            </a>
                          </TableCell>
                          <TableCell>
                            <Badge variant='outline'>
                              {getPlatformRegionLabel(platform.region)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className='flex flex-wrap justify-end gap-2'>
                              {activeSheet.accountId ? (
                                <Button
                                  type='button'
                                  variant='outline'
                                  size='sm'
                                  disabled={submitPending || isCurrent}
                                  onClick={() =>
                                    void handleBindPrimaryPlatform(platform.id)
                                  }
                                >
                                  {isCurrent ? '当前主平台' : '绑定'}
                                </Button>
                              ) : null}
                              {access.canUpdate ? (
                                <Button
                                  type='button'
                                  variant='outline'
                                  size='sm'
                                  onClick={() => openPlatformDialog(platform)}
                                >
                                  编辑
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!filteredPlatforms.length ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className='text-muted-foreground py-12 text-center'
                        >
                          暂无数据
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        );
      }

      case 'keys': {
        const allKeysSelected =
          filteredKeys.length > 0 &&
          filteredKeys.every((key) => selectedKeyIds.includes(key.id));

        return (
          <>
            <SheetHeader className='border-border/60 border-b pb-4'>
              <SheetTitle>密钥</SheetTitle>
            </SheetHeader>
            <div className='flex h-full min-h-0 flex-col px-4 pb-4'>
              <form
                className='border-border/60 flex flex-col gap-2 border-b py-4 lg:flex-row lg:items-center'
                onSubmit={(event) => {
                  event.preventDefault();
                  setKeySearchKeyword(keySearchDraft.trim());
                }}
              >
                <Input
                  value={keySearchDraft}
                  onChange={(event) => {
                    const value = event.target.value;
                    setKeySearchDraft(value);
                    if (!value.trim()) {
                      setKeySearchKeyword('');
                    }
                  }}
                  placeholder='搜索密钥标题 / 内容 / 过期时间'
                  className='h-10 flex-1 rounded-xl px-4'
                />
                <div className='flex flex-wrap items-center justify-end gap-2'>
                  <Button
                    type='submit'
                    variant='outline'
                    className={toolbarButtonClassName}
                    onMouseUp={(event) => event.currentTarget.blur()}
                  >
                    搜索
                  </Button>
                  {access.canCreate ? (
                    <Button
                      type='button'
                      variant='outline'
                      className={toolbarButtonClassName}
                      onClick={() => openKeyDialog()}
                      onMouseUp={(event) => event.currentTarget.blur()}
                    >
                      新增
                    </Button>
                  ) : null}
                  {access.canDelete ? (
                    <Button
                      type='button'
                      variant='outline'
                      className={toolbarButtonClassName}
                      disabled={!selectedKeyIds.length}
                      onClick={() =>
                        setDeleteTarget({
                          type: 'key',
                          ids: selectedKeyIds,
                          label:
                            selectedKeyIds.length > 1
                              ? `已选 ${selectedKeyIds.length} 条密钥`
                              : filteredKeys.find(
                                  (key) => key.id === selectedKeyIds[0]
                                )?.title || '当前密钥'
                        })
                      }
                      onMouseUp={(event) => event.currentTarget.blur()}
                    >
                      删除
                    </Button>
                  ) : null}
                </div>
              </form>

              <div className='min-h-0 flex-1 overflow-auto py-4'>
                <Table className='min-w-[980px]'>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='w-12'>
                        <Checkbox
                          checked={
                            allKeysSelected
                              ? true
                              : selectedKeyIds.length
                                ? 'indeterminate'
                                : false
                          }
                          onCheckedChange={(checked) =>
                            setSelectedKeyIds(
                              checked ? filteredKeys.map((key) => key.id) : []
                            )
                          }
                          aria-label='全选密钥'
                        />
                      </TableHead>
                      <TableHead>标题</TableHead>
                      <TableHead>内容</TableHead>
                      <TableHead>过期时间</TableHead>
                      <TableHead>更新时间</TableHead>
                      <TableHead className='w-[240px]'>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredKeys.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedKeyIds.includes(key.id)}
                            onCheckedChange={(checked) =>
                              setSelectedKeyIds((current) =>
                                toggleSelectedIds(current, key.id, checked)
                              )
                            }
                            aria-label={`选择密钥 ${key.title}`}
                          />
                        </TableCell>
                        <TableCell className='font-medium'>
                          {key.title}
                        </TableCell>
                        <TableCell className='max-w-md'>
                          <div className='truncate text-sm'>{key.content}</div>
                        </TableCell>
                        <TableCell>
                          {formatDateTimeLabel(key.expiresAt)}
                        </TableCell>
                        <TableCell>
                          {formatDateTimeLabel(key.updatedAt)}
                        </TableCell>
                        <TableCell>
                          <div className='flex flex-wrap justify-end gap-2'>
                            <Button
                              type='button'
                              variant='outline'
                              size='sm'
                              onClick={() =>
                                void handleCopy(key.content, '密钥内容')
                              }
                            >
                              复制
                            </Button>
                            {access.canUpdate ? (
                              <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                onClick={() => openKeyDialog(key)}
                              >
                                编辑
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!filteredKeys.length ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className='text-muted-foreground py-12 text-center'
                        >
                          暂无数据
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        );
      }

      case 'bindings':
        return (
          <>
            <SheetHeader>
              <SheetTitle>绑定信息</SheetTitle>
              <SheetDescription>
                绑定关系支持一次性新增多条，已有关系可以继续增删改。
              </SheetDescription>
            </SheetHeader>
            <div className='mt-6 grid gap-6'>
              <div className='space-y-3'>
                {selectedAccountDetail?.bindings.map((binding) => (
                  <div key={binding.id} className='rounded-lg border p-4'>
                    <div className='flex items-start justify-between gap-3'>
                      <div className='flex items-center gap-3'>
                        <PlatformIcon
                          iconUrl={binding.platformIconUrl}
                          name={binding.platformName}
                        />
                        <div>
                          <div className='font-medium'>
                            {binding.platformName || '平台已删除'}
                          </div>
                          <div className='text-muted-foreground text-sm'>
                            平台账号：{binding.platformAccount}
                          </div>
                        </div>
                      </div>
                      <div className='flex gap-2'>
                        {access.canUpdate ? (
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={() => beginEditBinding(binding)}
                          >
                            编辑
                          </Button>
                        ) : null}
                        {access.canDelete ? (
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={() =>
                              setDeleteTarget({
                                type: 'binding',
                                ids: [binding.id],
                                label: binding.platformAccount
                              })
                            }
                          >
                            删除
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
                {!selectedAccountDetail?.bindings.length ? (
                  <div className='text-muted-foreground rounded-lg border border-dashed px-4 py-10 text-center text-sm'>
                    当前还没有绑定关系。
                  </div>
                ) : null}
              </div>

              {canManageNested ? (
                <form
                  className='space-y-4 rounded-lg border p-4'
                  onSubmit={handleBindingSubmit}
                >
                  <div className='font-medium'>
                    {editingBindingId ? '编辑绑定关系' : '新增绑定关系'}
                  </div>
                  {editingBindingId ? (
                    <>
                      <Select
                        value={bindingForm.platformId || 'none'}
                        onValueChange={(value) =>
                          setBindingForm((current) => ({
                            ...current,
                            platformId: value === 'none' ? '' : value
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='请选择平台' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='none'>请选择平台</SelectItem>
                          {platforms.map((platform) => (
                            <SelectItem
                              key={platform.id}
                              value={String(platform.id)}
                            >
                              {platform.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={bindingForm.platformAccount}
                        onChange={(event) =>
                          setBindingForm((current) => ({
                            ...current,
                            platformAccount: event.target.value
                          }))
                        }
                        placeholder='请输入平台账号'
                      />
                    </>
                  ) : (
                    <div className='space-y-3'>
                      {bindingDrafts.map((draft, index) => (
                        <div
                          key={index}
                          className='grid gap-3 rounded-md border p-3'
                        >
                          <Select
                            value={draft.platformId || 'none'}
                            onValueChange={(value) =>
                              setBindingDrafts((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        platformId:
                                          value === 'none' ? '' : value
                                      }
                                    : item
                                )
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder='请选择平台' />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value='none'>请选择平台</SelectItem>
                              {platforms.map((platform) => (
                                <SelectItem
                                  key={platform.id}
                                  value={String(platform.id)}
                                >
                                  {platform.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            value={draft.platformAccount}
                            onChange={(event) =>
                              setBindingDrafts((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        platformAccount: event.target.value
                                      }
                                    : item
                                )
                              )
                            }
                            placeholder='请输入平台账号'
                          />
                          {bindingDrafts.length > 1 ? (
                            <Button
                              type='button'
                              variant='outline'
                              onClick={() =>
                                setBindingDrafts((current) =>
                                  current.filter(
                                    (_, itemIndex) => itemIndex !== index
                                  )
                                )
                              }
                            >
                              删除这一行
                            </Button>
                          ) : null}
                        </div>
                      ))}
                      <Button
                        type='button'
                        variant='outline'
                        onClick={() =>
                          setBindingDrafts((current) => [
                            ...current,
                            createDefaultBindingForm()
                          ])
                        }
                      >
                        <Plus className='mr-1 size-4' />
                        再添加一条
                      </Button>
                    </div>
                  )}
                  <div className='flex items-center justify-end gap-2'>
                    {editingBindingId ? (
                      <Button
                        type='button'
                        variant='outline'
                        onClick={() => {
                          setEditingBindingId(null);
                          setBindingForm(createDefaultBindingForm());
                        }}
                      >
                        取消编辑
                      </Button>
                    ) : null}
                    <Button type='submit' disabled={submitPending}>
                      {submitPending
                        ? '提交中...'
                        : editingBindingId
                          ? '保存修改'
                          : '批量新增'}
                    </Button>
                  </div>
                </form>
              ) : null}
            </div>
          </>
        );

      case 'sources': {
        const allSourcesSelected =
          filteredRegistrationSources.length > 0 &&
          filteredRegistrationSources.every((source) =>
            selectedCatalogSourceIds.includes(source.id)
          );

        return (
          <>
            <SheetHeader className='border-border/60 border-b pb-4'>
              <SheetTitle>注册源</SheetTitle>
            </SheetHeader>
            <div className='flex h-full min-h-0 flex-col px-4 pb-4'>
              <form
                className='border-border/60 flex flex-col gap-2 border-b py-4 lg:flex-row lg:items-center'
                onSubmit={(event) => {
                  event.preventDefault();
                  setSourceSearchKeyword(sourceSearchDraft.trim());
                }}
              >
                <Input
                  value={sourceSearchDraft}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSourceSearchDraft(value);
                    if (!value.trim()) {
                      setSourceSearchKeyword('');
                    }
                  }}
                  placeholder='搜索注册源名称 / 标识 / 官网'
                  className='h-10 flex-1 rounded-xl px-4'
                />
                <div className='flex flex-wrap items-center justify-end gap-2'>
                  <Button
                    type='submit'
                    variant='outline'
                    className={toolbarButtonClassName}
                    onMouseUp={(event) => event.currentTarget.blur()}
                  >
                    搜索
                  </Button>
                  {access.canCreate ? (
                    <Button
                      type='button'
                      variant='outline'
                      className={toolbarButtonClassName}
                      onClick={() => openSourceDialog()}
                      onMouseUp={(event) => event.currentTarget.blur()}
                    >
                      新增
                    </Button>
                  ) : null}
                  {access.canDelete ? (
                    <Button
                      type='button'
                      variant='outline'
                      className={toolbarButtonClassName}
                      disabled={!selectedCatalogSourceIds.length}
                      onClick={() =>
                        setDeleteTarget({
                          type: 'source',
                          ids: selectedCatalogSourceIds,
                          label:
                            selectedCatalogSourceIds.length > 1
                              ? `已选 ${selectedCatalogSourceIds.length} 个注册源`
                              : registrationSources.find(
                                  (source) =>
                                    source.id === selectedCatalogSourceIds[0]
                                )?.name || '当前注册源'
                        })
                      }
                      onMouseUp={(event) => event.currentTarget.blur()}
                    >
                      删除
                    </Button>
                  ) : null}
                </div>
              </form>

              <div className='min-h-0 flex-1 overflow-auto py-4'>
                <Table className='min-w-[1040px]'>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='w-12'>
                        <Checkbox
                          checked={
                            allSourcesSelected
                              ? true
                              : selectedCatalogSourceIds.length
                                ? 'indeterminate'
                                : false
                          }
                          onCheckedChange={(checked) =>
                            setSelectedCatalogSourceIds(
                              checked
                                ? filteredRegistrationSources.map(
                                    (source) => source.id
                                  )
                                : []
                            )
                          }
                          aria-label='全选注册源'
                        />
                      </TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead>标识</TableHead>
                      <TableHead>官网</TableHead>
                      <TableHead>备注</TableHead>
                      <TableHead className='w-[240px]'>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRegistrationSources.map((source) => {
                      const isBound = selectedSourceIds.includes(source.id);

                      return (
                        <TableRow key={source.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedCatalogSourceIds.includes(
                                source.id
                              )}
                              onCheckedChange={(checked) =>
                                setSelectedCatalogSourceIds((current) =>
                                  toggleSelectedIds(current, source.id, checked)
                                )
                              }
                              aria-label={`选择注册源 ${source.name}`}
                            />
                          </TableCell>
                          <TableCell className='font-medium'>
                            {source.name}
                          </TableCell>
                          <TableCell>{source.code}</TableCell>
                          <TableCell className='max-w-xs'>
                            {source.website ? (
                              <a
                                href={source.website}
                                target='_blank'
                                rel='noreferrer'
                                className='text-muted-foreground inline-flex max-w-full items-center gap-1 truncate text-sm underline-offset-4 hover:underline'
                              >
                                <span className='truncate'>
                                  {source.website}
                                </span>
                                <ExternalLink className='size-4 shrink-0' />
                              </a>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className='max-w-sm'>
                            <div className='truncate text-sm'>
                              {source.remark || '-'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className='flex flex-wrap justify-end gap-2'>
                              {activeSheet.accountId ? (
                                <Button
                                  type='button'
                                  variant='outline'
                                  size='sm'
                                  disabled={submitPending}
                                  onClick={() =>
                                    void handleSourceBindingToggle(
                                      source.id,
                                      !isBound
                                    )
                                  }
                                >
                                  {isBound ? '解绑' : '绑定'}
                                </Button>
                              ) : null}
                              {access.canUpdate ? (
                                <Button
                                  type='button'
                                  variant='outline'
                                  size='sm'
                                  onClick={() => openSourceDialog(source)}
                                >
                                  编辑
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!filteredRegistrationSources.length ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className='text-muted-foreground py-12 text-center'
                        >
                          暂无数据
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        );
      }

      case 'securities': {
        const allSecuritiesSelected =
          filteredSecurities.length > 0 &&
          filteredSecurities.every((security) =>
            selectedSecurityIds.includes(security.id)
          );

        return (
          <>
            <SheetHeader className='border-border/60 border-b pb-4'>
              <SheetTitle>密保</SheetTitle>
            </SheetHeader>
            <div className='flex h-full min-h-0 flex-col px-4 pb-4'>
              <form
                className='border-border/60 flex flex-col gap-2 border-b py-4 lg:flex-row lg:items-center'
                onSubmit={(event) => {
                  event.preventDefault();
                  setSecuritySearchKeyword(securitySearchDraft.trim());
                }}
              >
                <Input
                  value={securitySearchDraft}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSecuritySearchDraft(value);
                    if (!value.trim()) {
                      setSecuritySearchKeyword('');
                    }
                  }}
                  placeholder='搜索密保类型 / 内容 / 更新时间'
                  className='h-10 flex-1 rounded-xl px-4'
                />
                <div className='flex flex-wrap items-center justify-end gap-2'>
                  <Button
                    type='submit'
                    variant='outline'
                    className={toolbarButtonClassName}
                    onMouseUp={(event) => event.currentTarget.blur()}
                  >
                    搜索
                  </Button>
                  {access.canCreate ? (
                    <Button
                      type='button'
                      variant='outline'
                      className={toolbarButtonClassName}
                      onClick={() => openSecurityDialog()}
                      onMouseUp={(event) => event.currentTarget.blur()}
                    >
                      新增
                    </Button>
                  ) : null}
                  {access.canDelete ? (
                    <Button
                      type='button'
                      variant='outline'
                      className={toolbarButtonClassName}
                      disabled={!selectedSecurityIds.length}
                      onClick={() =>
                        setDeleteTarget({
                          type: 'security',
                          ids: selectedSecurityIds,
                          label:
                            selectedSecurityIds.length > 1
                              ? `已选 ${selectedSecurityIds.length} 条密保`
                              : filteredSecurities.find(
                                    (security) =>
                                      security.id === selectedSecurityIds[0]
                                  )
                                ? getSecurityTypeLabel(
                                    filteredSecurities.find(
                                      (security) =>
                                        security.id === selectedSecurityIds[0]
                                    )!.securityType
                                  )
                                : '当前密保'
                        })
                      }
                      onMouseUp={(event) => event.currentTarget.blur()}
                    >
                      删除
                    </Button>
                  ) : null}
                </div>
              </form>

              <div className='min-h-0 flex-1 overflow-auto py-4'>
                <Table className='min-w-[820px]'>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='w-12'>
                        <Checkbox
                          checked={
                            allSecuritiesSelected
                              ? true
                              : selectedSecurityIds.length
                                ? 'indeterminate'
                                : false
                          }
                          onCheckedChange={(checked) =>
                            setSelectedSecurityIds(
                              checked
                                ? filteredSecurities.map(
                                    (security) => security.id
                                  )
                                : []
                            )
                          }
                          aria-label='全选密保'
                        />
                      </TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>内容</TableHead>
                      <TableHead>更新时间</TableHead>
                      <TableHead className='w-[180px]'>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSecurities.map((security) => (
                      <TableRow key={security.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedSecurityIds.includes(security.id)}
                            onCheckedChange={(checked) =>
                              setSelectedSecurityIds((current) =>
                                toggleSelectedIds(current, security.id, checked)
                              )
                            }
                            aria-label={`选择密保 ${getSecurityTypeLabel(security.securityType)}`}
                          />
                        </TableCell>
                        <TableCell className='font-medium'>
                          {getSecurityTypeLabel(security.securityType)}
                        </TableCell>
                        <TableCell className='max-w-xl'>
                          <div className='truncate text-sm'>
                            {security.content}
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatDateTimeLabel(security.updatedAt)}
                        </TableCell>
                        <TableCell>
                          <div className='flex flex-wrap justify-end gap-2'>
                            {access.canUpdate ? (
                              <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                onClick={() => openSecurityDialog(security)}
                              >
                                编辑
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!filteredSecurities.length ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className='text-muted-foreground py-12 text-center'
                        >
                          暂无数据
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        );
      }

      case 'wealth': {
        const allWealthSelected =
          filteredWealthEntries.length > 0 &&
          filteredWealthEntries.every(({ index }) =>
            selectedWealthIndices.includes(index)
          );

        return (
          <>
            <SheetHeader className='border-border/60 border-b pb-4'>
              <SheetTitle>补充信息</SheetTitle>
            </SheetHeader>
            <div className='flex h-full min-h-0 flex-col px-4 pb-4'>
              <form
                className='border-border/60 flex flex-col gap-2 border-b py-4 lg:flex-row lg:items-center'
                onSubmit={(event) => {
                  event.preventDefault();
                  setWealthSearchKeyword(wealthSearchDraft.trim());
                }}
              >
                <Input
                  value={wealthSearchDraft}
                  onChange={(event) => {
                    const value = event.target.value;
                    setWealthSearchDraft(value);
                    if (!value.trim()) {
                      setWealthSearchKeyword('');
                    }
                  }}
                  placeholder='搜索标题 / 内容'
                  className='h-10 flex-1 rounded-xl px-4'
                />
                <div className='flex flex-wrap items-center justify-end gap-2'>
                  <Button
                    type='submit'
                    variant='outline'
                    className={toolbarButtonClassName}
                    onMouseUp={(event) => event.currentTarget.blur()}
                  >
                    搜索
                  </Button>
                  {access.canCreate ? (
                    <Button
                      type='button'
                      variant='outline'
                      className={toolbarButtonClassName}
                      onClick={() => openWealthDialog()}
                      onMouseUp={(event) => event.currentTarget.blur()}
                    >
                      新增
                    </Button>
                  ) : null}
                  {access.canDelete ? (
                    <Button
                      type='button'
                      variant='outline'
                      className={toolbarButtonClassName}
                      disabled={!selectedWealthIndices.length}
                      onClick={() =>
                        setDeleteTarget({
                          type: 'wealth',
                          ids: selectedWealthIndices,
                          label:
                            selectedWealthIndices.length > 1
                              ? `已选 ${selectedWealthIndices.length} 条补充信息`
                              : wealthDrafts[selectedWealthIndices[0]]?.key ||
                                '当前补充信息'
                        })
                      }
                      onMouseUp={(event) => event.currentTarget.blur()}
                    >
                      删除
                    </Button>
                  ) : null}
                </div>
              </form>

              <div className='min-h-0 flex-1 overflow-auto py-4'>
                <Table className='min-w-[760px]'>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='w-12'>
                        <Checkbox
                          checked={
                            allWealthSelected
                              ? true
                              : selectedWealthIndices.length
                                ? 'indeterminate'
                                : false
                          }
                          onCheckedChange={(checked) =>
                            setSelectedWealthIndices(
                              checked
                                ? filteredWealthEntries.map(
                                    ({ index }) => index
                                  )
                                : []
                            )
                          }
                          aria-label='全选补充信息'
                        />
                      </TableHead>
                      <TableHead>标题</TableHead>
                      <TableHead>内容</TableHead>
                      <TableHead className='w-[180px]'>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWealthEntries.map(({ entry, index }) => (
                      <TableRow key={`${entry.key}-${index}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedWealthIndices.includes(index)}
                            onCheckedChange={(checked) =>
                              setSelectedWealthIndices((current) =>
                                toggleSelectedIds(current, index, checked)
                              )
                            }
                            aria-label={`选择补充信息 ${entry.key || index + 1}`}
                          />
                        </TableCell>
                        <TableCell className='font-medium'>
                          {entry.key || '-'}
                        </TableCell>
                        <TableCell className='max-w-xl'>
                          <div className='truncate text-sm'>
                            {entry.value || '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='flex flex-wrap justify-end gap-2'>
                            {access.canUpdate ? (
                              <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                onClick={() => openWealthDialog(index)}
                              >
                                编辑
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!filteredWealthEntries.length ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className='text-muted-foreground py-12 text-center'
                        >
                          暂无数据
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        );
      }

      case 'closed':
        return null;
    }
  }

  if (!workspaceId) {
    return (
      <Card className='min-w-0'>
        <CardHeader>
          <CardTitle>账号管理</CardTitle>
          <CardDescription>
            请先选择一个工作区，再进行账号、平台和注册源管理。
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card className='min-w-0'>
        <CardHeader className='flex flex-col gap-4'>
          <div>
            <CardTitle>账号列表</CardTitle>
            <CardDescription>
              账号管理承接主平台、密钥、绑定关系、注册源、密保和财富信息，支持按工作区独立维护。
            </CardDescription>
          </div>
          <form
            className='flex flex-col gap-3 lg:flex-row lg:items-center'
            onSubmit={handleSearchSubmit}
          >
            <div className='border-border/60 bg-background/40 flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-2xl border p-2 md:flex-nowrap'>
              <Input
                value={searchDraft}
                onChange={(event) => {
                  const value = event.target.value;
                  setSearchDraft(value);
                  if (!value.trim()) {
                    setSearchKeyword('');
                    setPage(1);
                  }
                }}
                placeholder='搜索账号 / 平台 / 注册源'
                className='h-10 min-w-[280px] flex-[1_1_360px] border-0 bg-transparent px-3 shadow-none focus-visible:border-transparent focus-visible:ring-0'
              />
              <div className='bg-border/60 hidden h-7 w-px shrink-0 md:block' />
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as typeof statusFilter);
                  setPage(1);
                }}
              >
                <SelectTrigger className='h-10 min-w-[112px] border-0 bg-transparent px-3 shadow-none focus-visible:border-transparent focus-visible:ring-0'>
                  <span className='truncate'>{statusTriggerLabel}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>全部</SelectItem>
                  <SelectItem value='available'>可用</SelectItem>
                  <SelectItem value='banned'>封禁</SelectItem>
                  <SelectItem value='cancelled'>已注销</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={attributeFilter}
                onValueChange={(value) => {
                  setAttributeFilter(value as typeof attributeFilter);
                  setPage(1);
                }}
              >
                <SelectTrigger className='h-10 min-w-[112px] border-0 bg-transparent px-3 shadow-none focus-visible:border-transparent focus-visible:ring-0'>
                  <span className='truncate'>{attributeTriggerLabel}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>全部</SelectItem>
                  <SelectItem value='self_hosted'>自托管</SelectItem>
                  <SelectItem value='third_party'>三方</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={confidenceFilter}
                onValueChange={(value) => {
                  setConfidenceFilter(value as typeof confidenceFilter);
                  setPage(1);
                }}
              >
                <SelectTrigger className='h-10 min-w-[112px] border-0 bg-transparent px-3 shadow-none focus-visible:border-transparent focus-visible:ring-0'>
                  <span className='truncate'>{confidenceTriggerLabel}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>全部</SelectItem>
                  <SelectItem value='very_high'>极高</SelectItem>
                  <SelectItem value='high'>高</SelectItem>
                  <SelectItem value='medium'>中</SelectItem>
                  <SelectItem value='low'>低</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='flex shrink-0 items-center justify-end gap-2'>
              <Button
                type='submit'
                variant='outline'
                className={toolbarButtonClassName}
                onMouseUp={(event) => event.currentTarget.blur()}
              >
                搜索
              </Button>
              {access.canCreate ? (
                <Button
                  type='button'
                  variant='outline'
                  className={toolbarButtonClassName}
                  onClick={() => void openAccountEditor()}
                  onMouseUp={(event) => event.currentTarget.blur()}
                >
                  新增
                </Button>
              ) : null}
              {access.canDelete ? (
                <Button
                  type='button'
                  variant='outline'
                  className={toolbarButtonClassName}
                  disabled={!selectedAccountIds.length}
                  onClick={() =>
                    setDeleteTarget({
                      type: 'account',
                      ids: selectedAccountIds,
                      label:
                        selectedAccountIds.length > 1
                          ? `已选 ${selectedAccountIds.length} 个账号`
                          : accounts.find(
                              (account) => account.id === selectedAccountIds[0]
                            )?.account || '当前账号'
                    })
                  }
                  onMouseUp={(event) => event.currentTarget.blur()}
                >
                  删除
                </Button>
              ) : null}
            </div>
          </form>
        </CardHeader>
        <CardContent className='min-w-0'>
          <div className='border-border/60 min-w-0 rounded-2xl border'>
            <Table className='min-w-[1680px]'>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-12'>
                    <Checkbox
                      checked={
                        allAccountsSelected
                          ? true
                          : selectedAccountIds.length
                            ? 'indeterminate'
                            : false
                      }
                      onCheckedChange={(checked) =>
                        setSelectedAccountIds(
                          checked ? accounts.map((account) => account.id) : []
                        )
                      }
                      aria-label='全选账号'
                    />
                  </TableHead>
                  <TableHead className='w-[84px] min-w-[84px]'>icon</TableHead>
                  <TableHead className='min-w-[120px]'>平台</TableHead>
                  <TableHead className='min-w-[240px]'>账号</TableHead>
                  <TableHead className='min-w-[96px]'>属性</TableHead>
                  <TableHead className='min-w-[96px]'>置信度</TableHead>
                  <TableHead className='min-w-[108px]'>密钥</TableHead>
                  <TableHead className='min-w-[120px]'>绑定信息</TableHead>
                  <TableHead className='min-w-[180px]'>注册源</TableHead>
                  <TableHead className='min-w-[116px]'>密码</TableHead>
                  <TableHead className='min-w-[108px]'>密保</TableHead>
                  <TableHead className='min-w-[96px]'>状态</TableHead>
                  <TableHead className='min-w-[120px]'>财富</TableHead>
                  <TableHead className='min-w-[168px]'>注册时间</TableHead>
                  <TableHead className='w-[160px] min-w-[160px]'>
                    操作
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedAccountIds.includes(account.id)}
                        onCheckedChange={(checked) =>
                          setSelectedAccountIds((current) =>
                            toggleSelectedIds(current, account.id, checked)
                          )
                        }
                        aria-label={`选择账号 ${account.account}`}
                      />
                    </TableCell>
                    <TableCell className='w-[84px] min-w-[84px]'>
                      <div className='flex items-center justify-center'>
                        <PlatformIcon
                          iconUrl={account.platformIconUrl}
                          name={account.platformName}
                        />
                      </div>
                    </TableCell>
                    <TableCell className='min-w-[120px]'>
                      {account.platformName ? (
                        <ActionLinkButton
                          disabled={!canManageNested}
                          onClick={() =>
                            void openAccountSheet('platforms', account)
                          }
                        >
                          {account.platformName}
                        </ActionLinkButton>
                      ) : (
                        <ActionLinkButton
                          disabled={!canManageNested}
                          onClick={() =>
                            void openAccountSheet('platforms', account)
                          }
                        >
                          绑定
                        </ActionLinkButton>
                      )}
                    </TableCell>
                    <TableCell className='min-w-[240px]'>
                      <div className='flex min-w-[220px] items-center gap-2'>
                        <span className='block max-w-[190px] truncate'>
                          {account.account}
                        </span>
                        <Button
                          type='button'
                          variant='outline'
                          size='icon'
                          className='size-8 shrink-0 rounded-lg'
                          onClick={() =>
                            void handleCopy(account.account, '账号')
                          }
                        >
                          <Copy className='size-4' />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className='min-w-[96px]'>
                      <Badge variant='outline'>
                        {getAccountAttributeLabel(account.attribute)}
                      </Badge>
                    </TableCell>
                    <TableCell className='min-w-[96px]'>
                      <Badge variant='outline'>
                        {getAccountConfidenceLabel(account.confidence)}
                      </Badge>
                    </TableCell>
                    <TableCell className='min-w-[108px]'>
                      <ActionLinkButton
                        disabled={!canManageNested}
                        onClick={() => void openAccountSheet('keys', account)}
                      >
                        {account.keyCount
                          ? `详情（${account.keyCount}）`
                          : '添加'}
                      </ActionLinkButton>
                    </TableCell>
                    <TableCell className='min-w-[120px]'>
                      <ActionLinkButton
                        disabled={!canManageNested}
                        onClick={() =>
                          void openAccountSheet('bindings', account)
                        }
                      >
                        {account.bindingCount
                          ? `详情（${account.bindingCount}）`
                          : '绑定'}
                      </ActionLinkButton>
                    </TableCell>
                    <TableCell className='min-w-[180px]'>
                      {account.registrationSources.length ? (
                        <div className='inline-flex flex-nowrap gap-2'>
                          {account.registrationSources.map((source) => (
                            <ActionLinkButton
                              key={source.id}
                              disabled={!canManageNested}
                              onClick={() =>
                                void openAccountSheet('sources', account)
                              }
                            >
                              {source.name}
                            </ActionLinkButton>
                          ))}
                        </div>
                      ) : (
                        <ActionLinkButton
                          disabled={!canManageNested}
                          onClick={() =>
                            void openAccountSheet('sources', account)
                          }
                        >
                          绑定
                        </ActionLinkButton>
                      )}
                    </TableCell>
                    <TableCell className='min-w-[116px]'>
                      {account.hasPassword ? '已加密存储' : '未设置'}
                    </TableCell>
                    <TableCell className='min-w-[108px]'>
                      <ActionLinkButton
                        disabled={!canManageNested}
                        onClick={() =>
                          void openAccountSheet('securities', account)
                        }
                      >
                        {account.securityCount
                          ? `详情（${account.securityCount}）`
                          : '添加'}
                      </ActionLinkButton>
                    </TableCell>
                    <TableCell className='min-w-[96px]'>
                      <Badge variant='outline'>
                        {getAccountStatusLabel(account.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className='min-w-[120px]'>
                      <ActionLinkButton
                        disabled={!canManageNested}
                        onClick={() => void openAccountSheet('wealth', account)}
                      >
                        {account.wealthEntries.length ? '详情' : '补充信息'}
                      </ActionLinkButton>
                    </TableCell>
                    <TableCell className='min-w-[168px]'>
                      {formatDateTimeLabel(account.registeredAt)}
                    </TableCell>
                    <TableCell className='w-[160px] min-w-[160px]'>
                      <div className='flex flex-nowrap gap-2'>
                        {access.canUpdate ? (
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={() => void openAccountEditor(account)}
                          >
                            编辑
                          </Button>
                        ) : null}
                        {access.canDelete ? (
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={() =>
                              setDeleteTarget({
                                type: 'account',
                                ids: [account.id],
                                label: account.account
                              })
                            }
                          >
                            删除
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!accounts.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={15}
                      className='text-muted-foreground py-10 text-center'
                    >
                      当前没有匹配的账号记录。
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          <div className='mt-4'>
            <ManagementPagination
              pagination={pagination}
              pending={listPending}
              onPageChange={setPage}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={accountDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeSheet();
          }
        }}
      >
        {renderAccountDialogContent()}
      </Dialog>

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeSheet();
          }
        }}
      >
        <SheetContent
          className={
            wideSheetActive
              ? 'w-full overflow-hidden p-0 sm:max-w-none md:min-w-[680px]'
              : 'w-full overflow-y-auto sm:max-w-3xl'
          }
          style={
            wideSheetActive
              ? {
                  width: wideSheetWidth,
                  maxWidth: '96vw'
                }
              : undefined
          }
        >
          {wideSheetActive ? (
            <>
              <div
                className='absolute inset-y-0 left-0 z-20 hidden w-5 cursor-ew-resize items-center justify-center md:flex'
                onMouseDown={(event) => {
                  event.preventDefault();
                  setResizingWideSheet(true);
                }}
              >
                <div className='bg-border/80 h-24 w-[3px] rounded-full' />
              </div>
              <div className='h-full overflow-hidden pl-3'>
                {renderSheetContent()}
              </div>
            </>
          ) : (
            renderSheetContent()
          )}
        </SheetContent>
      </Sheet>

      <Dialog
        open={platformDialogOpen}
        onOpenChange={(open) => {
          setPlatformDialogOpen(open);
          if (!open) {
            setPlatformEditingId(null);
            setPlatformForm(createDefaultPlatformForm());
          }
        }}
      >
        <DialogContent className='border-border/60 bg-background/95 overflow-hidden p-0 shadow-2xl sm:max-w-2xl'>
          <DialogHeader className='border-border/60 border-b px-6 pt-6 pb-4'>
            <DialogTitle>
              {platformEditingId ? '编辑平台' : '新增平台'}
            </DialogTitle>
            <DialogDescription>
              维护平台名称、地址与 Icon，地址会作为主链接展示。
            </DialogDescription>
          </DialogHeader>
          <form
            className='space-y-5 px-6 pt-5 pb-6'
            onSubmit={handlePlatformSubmit}
          >
            <div className='grid gap-5 md:grid-cols-2'>
              <div className='grid gap-2'>
                <div className='text-sm font-medium'>平台名称</div>
                <Input
                  value={platformForm.name}
                  onChange={(event) =>
                    setPlatformForm((current) => ({
                      ...current,
                      name: event.target.value
                    }))
                  }
                  placeholder='请输入平台名称'
                  className='h-11 rounded-xl px-4'
                />
              </div>
              <div className='grid gap-2'>
                <div className='text-sm font-medium'>网域性质</div>
                <Select
                  value={platformForm.region}
                  onValueChange={(value: ManagedPlatformSummary['region']) =>
                    setPlatformForm((current) => ({
                      ...current,
                      region: value
                    }))
                  }
                >
                  <SelectTrigger className='h-11 rounded-xl px-4'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='mainland'>内地</SelectItem>
                    <SelectItem value='hk_mo_tw'>港澳台</SelectItem>
                    <SelectItem value='overseas'>海外</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='grid gap-2'>
              <div className='text-sm font-medium'>平台地址</div>
              <Input
                value={platformForm.url}
                onChange={(event) =>
                  setPlatformForm((current) => ({
                    ...current,
                    url: event.target.value
                  }))
                }
                placeholder='https://example.com'
                className='h-11 rounded-xl px-4'
              />
            </div>

            <div className='grid gap-2'>
              <div className='text-sm font-medium'>平台 Icon 地址</div>
              <Input
                value={platformForm.iconUrl}
                onChange={(event) =>
                  setPlatformForm((current) => ({
                    ...current,
                    iconUrl: event.target.value
                  }))
                }
                placeholder='留空则自动使用 /favicon.ico'
                className='h-11 rounded-xl px-4'
              />
            </div>

            <DialogFooter className='border-border/60 border-t px-0 pt-4'>
              <Button
                type='button'
                variant='outline'
                className='rounded-xl'
                onClick={() => {
                  setPlatformDialogOpen(false);
                  setPlatformEditingId(null);
                  setPlatformForm(createDefaultPlatformForm());
                }}
              >
                取消
              </Button>
              <Button
                type='submit'
                className='rounded-xl'
                disabled={submitPending}
              >
                {submitPending
                  ? '保存中...'
                  : platformEditingId
                    ? '保存修改'
                    : '创建平台'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={keyDialogOpen}
        onOpenChange={(open) => {
          setKeyDialogOpen(open);
          if (!open) {
            setEditingKeyId(null);
            setKeyForm(createDefaultKeyForm());
          }
        }}
      >
        <DialogContent className='border-border/60 bg-background/95 overflow-hidden p-0 shadow-2xl sm:max-w-2xl'>
          <DialogHeader className='border-border/60 border-b px-6 pt-6 pb-4'>
            <DialogTitle>{editingKeyId ? '编辑密钥' : '新增密钥'}</DialogTitle>
            <DialogDescription>
              在弹窗中维护密钥标题、内容和过期时间。
            </DialogDescription>
          </DialogHeader>
          <form className='space-y-5 px-6 pt-5 pb-6' onSubmit={handleKeySubmit}>
            <div className='grid gap-2'>
              <div className='text-sm font-medium'>密钥标题</div>
              <Input
                value={keyForm.title}
                onChange={(event) =>
                  setKeyForm((current) => ({
                    ...current,
                    title: event.target.value
                  }))
                }
                placeholder='请输入密钥标题'
                className='h-11 rounded-xl px-4'
              />
            </div>

            <div className='grid gap-2'>
              <div className='text-sm font-medium'>密钥内容</div>
              <Textarea
                value={keyForm.content}
                onChange={(event) =>
                  setKeyForm((current) => ({
                    ...current,
                    content: event.target.value
                  }))
                }
                rows={6}
                placeholder='请输入密钥内容'
                className='rounded-2xl px-4 py-3'
              />
            </div>

            <div className='grid gap-2'>
              <div className='text-sm font-medium'>过期时间</div>
              <Input
                type='datetime-local'
                value={keyForm.expiresAt}
                onChange={(event) =>
                  setKeyForm((current) => ({
                    ...current,
                    expiresAt: event.target.value
                  }))
                }
                className='h-11 rounded-xl px-4'
              />
            </div>

            <DialogFooter className='border-border/60 border-t px-0 pt-4'>
              <Button
                type='button'
                variant='outline'
                className='rounded-xl'
                onClick={() => {
                  setKeyDialogOpen(false);
                  setEditingKeyId(null);
                  setKeyForm(createDefaultKeyForm());
                }}
              >
                取消
              </Button>
              <Button
                type='submit'
                className='rounded-xl'
                disabled={submitPending}
              >
                {submitPending
                  ? '保存中...'
                  : editingKeyId
                    ? '保存修改'
                    : '创建密钥'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={securityDialogOpen}
        onOpenChange={(open) => {
          setSecurityDialogOpen(open);
          if (!open) {
            setEditingSecurityId(null);
            setSecurityForm(createDefaultSecurityForm());
          }
        }}
      >
        <DialogContent className='border-border/60 bg-background/95 overflow-hidden p-0 shadow-2xl sm:max-w-2xl'>
          <DialogHeader className='border-border/60 border-b px-6 pt-6 pb-4'>
            <DialogTitle>
              {editingSecurityId ? '编辑密保' : '新增密保'}
            </DialogTitle>
            <DialogDescription>
              统一在弹窗里维护密保类型和明文内容。
            </DialogDescription>
          </DialogHeader>
          <form
            className='space-y-5 px-6 pt-5 pb-6'
            onSubmit={handleSecuritySubmit}
          >
            <div className='grid gap-2'>
              <div className='text-sm font-medium'>密保类型</div>
              <Select
                value={securityForm.securityType}
                onValueChange={(
                  value: ManagedAccountSecuritySummary['securityType']
                ) =>
                  setSecurityForm((current) => ({
                    ...current,
                    securityType: value
                  }))
                }
              >
                <SelectTrigger className='h-11 rounded-xl px-4'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='question'>问题验证</SelectItem>
                  <SelectItem value='two_factor'>2FA验证</SelectItem>
                  <SelectItem value='contact'>联系人</SelectItem>
                  <SelectItem value='emergency_email'>紧急邮箱</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='grid gap-2'>
              <div className='text-sm font-medium'>密保内容</div>
              <Textarea
                value={securityForm.content}
                onChange={(event) =>
                  setSecurityForm((current) => ({
                    ...current,
                    content: event.target.value
                  }))
                }
                rows={6}
                placeholder='请输入密保内容'
                className='rounded-2xl px-4 py-3'
              />
            </div>

            <DialogFooter className='border-border/60 border-t px-0 pt-4'>
              <Button
                type='button'
                variant='outline'
                className='rounded-xl'
                onClick={() => {
                  setSecurityDialogOpen(false);
                  setEditingSecurityId(null);
                  setSecurityForm(createDefaultSecurityForm());
                }}
              >
                取消
              </Button>
              <Button
                type='submit'
                className='rounded-xl'
                disabled={submitPending}
              >
                {submitPending
                  ? '保存中...'
                  : editingSecurityId
                    ? '保存修改'
                    : '创建密保'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={wealthDialogOpen}
        onOpenChange={(open) => {
          setWealthDialogOpen(open);
          if (!open) {
            setEditingWealthIndex(null);
            setWealthForm(createDefaultWealthForm());
          }
        }}
      >
        <DialogContent className='border-border/60 bg-background/95 overflow-hidden p-0 shadow-2xl sm:max-w-2xl'>
          <DialogHeader className='border-border/60 border-b px-6 pt-6 pb-4'>
            <DialogTitle>
              {editingWealthIndex === null ? '新增补充信息' : '编辑补充信息'}
            </DialogTitle>
            <DialogDescription>
              使用键值对维护账号的补充展示内容。
            </DialogDescription>
          </DialogHeader>
          <form
            className='space-y-5 px-6 pt-5 pb-6'
            onSubmit={handleWealthEntrySubmit}
          >
            <div className='grid gap-2'>
              <div className='text-sm font-medium'>标题</div>
              <Input
                value={wealthForm.key}
                onChange={(event) =>
                  setWealthForm((current) => ({
                    ...current,
                    key: event.target.value
                  }))
                }
                placeholder='例如：资产备注'
                className='h-11 rounded-xl px-4'
              />
            </div>

            <div className='grid gap-2'>
              <div className='text-sm font-medium'>内容</div>
              <Textarea
                value={wealthForm.value}
                onChange={(event) =>
                  setWealthForm((current) => ({
                    ...current,
                    value: event.target.value
                  }))
                }
                rows={5}
                placeholder='请输入补充信息内容'
                className='rounded-2xl px-4 py-3'
              />
            </div>

            <DialogFooter className='border-border/60 border-t px-0 pt-4'>
              <Button
                type='button'
                variant='outline'
                className='rounded-xl'
                onClick={() => {
                  setWealthDialogOpen(false);
                  setEditingWealthIndex(null);
                  setWealthForm(createDefaultWealthForm());
                }}
              >
                取消
              </Button>
              <Button
                type='submit'
                className='rounded-xl'
                disabled={submitPending}
              >
                {submitPending
                  ? '保存中...'
                  : editingWealthIndex === null
                    ? '创建补充信息'
                    : '保存修改'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={sourceDialogOpen}
        onOpenChange={(open) => {
          setSourceDialogOpen(open);
          if (!open) {
            setEditingSourceId(null);
            setRegistrationSourceForm(createDefaultRegistrationSourceForm());
          }
        }}
      >
        <DialogContent className='border-border/60 bg-background/95 overflow-hidden p-0 shadow-2xl sm:max-w-2xl'>
          <DialogHeader className='border-border/60 border-b px-6 pt-6 pb-4'>
            <DialogTitle>
              {editingSourceId ? '编辑注册源' : '新增注册源'}
            </DialogTitle>
            <DialogDescription>
              使用更宽松的留白维护注册源基础信息，列表里的编辑会在这里打开。
            </DialogDescription>
          </DialogHeader>
          <form
            className='space-y-5 px-6 pt-5 pb-6'
            onSubmit={handleRegistrationSourceSubmit}
          >
            <div className='grid gap-5 md:grid-cols-2'>
              <div className='grid gap-2'>
                <div className='text-sm font-medium'>名称</div>
                <Input
                  value={registrationSourceForm.name}
                  onChange={(event) =>
                    setRegistrationSourceForm((current) => ({
                      ...current,
                      name: event.target.value
                    }))
                  }
                  placeholder='请输入注册源名称'
                  className='h-11 rounded-xl px-4'
                />
              </div>
              <div className='grid gap-2'>
                <div className='text-sm font-medium'>标识</div>
                <Input
                  value={registrationSourceForm.code}
                  onChange={(event) =>
                    setRegistrationSourceForm((current) => ({
                      ...current,
                      code: event.target.value
                    }))
                  }
                  placeholder='请输入唯一标识'
                  className='h-11 rounded-xl px-4'
                />
              </div>
            </div>

            <div className='grid gap-2'>
              <div className='text-sm font-medium'>官网地址</div>
              <Input
                value={registrationSourceForm.website}
                onChange={(event) =>
                  setRegistrationSourceForm((current) => ({
                    ...current,
                    website: event.target.value
                  }))
                }
                placeholder='https://example.com'
                className='h-11 rounded-xl px-4'
              />
            </div>

            <div className='grid gap-2'>
              <div className='text-sm font-medium'>备注</div>
              <Textarea
                value={registrationSourceForm.remark}
                onChange={(event) =>
                  setRegistrationSourceForm((current) => ({
                    ...current,
                    remark: event.target.value
                  }))
                }
                placeholder='补充说明来源渠道、账号适用范围等'
                rows={5}
                className='rounded-2xl px-4 py-3'
              />
            </div>

            <DialogFooter className='border-border/60 border-t px-0 pt-4'>
              <Button
                type='button'
                variant='outline'
                className='rounded-xl'
                onClick={() => {
                  setSourceDialogOpen(false);
                  setEditingSourceId(null);
                  setRegistrationSourceForm(
                    createDefaultRegistrationSourceForm()
                  );
                }}
              >
                取消
              </Button>
              <Button
                type='submit'
                className='rounded-xl'
                disabled={submitPending}
              >
                {submitPending
                  ? '保存中...'
                  : editingSourceId
                    ? '保存修改'
                    : '创建注册源'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        title='确认删除'
        description={
          deleteTarget
            ? `确认删除${
                deleteTarget.label.startsWith('已选')
                  ? deleteTarget.label
                  : `“${deleteTarget.label}”`
              }吗？删除后无法恢复。`
            : '确认删除当前内容吗？删除后无法恢复。'
        }
        confirmLabel='确认删除'
        pending={deletePending}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </>
  );
}
