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
  type: 'account' | 'platform' | 'source' | 'key' | 'binding' | 'security';
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

function createEmptyWealthEntries(): ManagedWealthEntry[] {
  return [{ key: '', value: '' }];
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
      className='size-8 rounded-md border object-cover'
    />
  ) : (
    <div className='bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-md border text-xs'>
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
  const [selectedSourceIds, setSelectedSourceIds] = useState<number[]>([]);
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<number[]>([]);
  const [selectedCatalogSourceIds, setSelectedCatalogSourceIds] = useState<
    number[]
  >([]);
  const [wealthDrafts, setWealthDrafts] = useState<ManagedWealthEntry[]>(
    createEmptyWealthEntries()
  );
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
  const sheetOpen = activeSheet.type !== 'closed';
  const wideSheetActive =
    activeSheet.type === 'platforms' || activeSheet.type === 'sources';
  const toolbarButtonClassName =
    'h-10 rounded-xl px-4 focus-visible:bg-white focus-visible:text-black active:bg-white active:text-black';

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
    setBindingForm(createDefaultBindingForm());
    setBindingDrafts([createDefaultBindingForm()]);
    setEditingBindingId(null);
    setSecurityForm(createDefaultSecurityForm());
    setEditingSecurityId(null);
    setSelectedSourceIds([]);
    setSelectedPlatformIds([]);
    setSelectedCatalogSourceIds([]);
    setWealthDrafts(createEmptyWealthEntries());
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

  async function handleWealthSave() {
    if (!workspaceId || !selectedAccountDetail) {
      return;
    }

    setSubmitPending(true);

    try {
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
            wealthEntries: wealthDrafts.filter(
              (entry) => entry.key.trim() && entry.value.trim()
            ),
            sourceIds: selectedAccountDetail.registrationSourceIds
          })
        }
      );

      setSelectedAccountDetail(data.account);
      setWealthDrafts(
        data.account.wealthEntries.length
          ? data.account.wealthEntries
          : createEmptyWealthEntries()
      );
      toast.success('财富信息已保存。');
      await refreshAccounts();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitPending(false);
    }
  }

  function beginEditKey(key: ManagedAccountKeySummary) {
    setEditingKeyId(key.id);
    setKeyForm({
      title: key.title,
      content: key.content,
      expiresAt: toDateTimeLocalValue(key.expiresAt)
    });
  }

  function beginEditBinding(binding: ManagedAccountBindingSummary) {
    setEditingBindingId(binding.id);
    setBindingForm({
      platformId: binding.platformId ? String(binding.platformId) : '',
      platformAccount: binding.platformAccount
    });
  }

  function beginEditSecurity(security: ManagedAccountSecuritySummary) {
    setEditingSecurityId(security.id);
    setSecurityForm({
      securityType: security.securityType,
      content: security.content
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
          const data = await requestJson<{ account: ManagedAccountDetail }>(
            `/api/admin/accounts/keys/${deleteTarget.ids[0]}?workspaceId=${workspaceId}`,
            { method: 'DELETE' }
          );
          setSelectedAccountDetail(data.account);
          toast.success('密钥已删除。');
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
          const data = await requestJson<{ account: ManagedAccountDetail }>(
            `/api/admin/accounts/securities/${deleteTarget.ids[0]}?workspaceId=${workspaceId}`,
            { method: 'DELETE' }
          );
          setSelectedAccountDetail(data.account);
          toast.success('密保已删除。');
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
        return (
          <>
            <SheetHeader>
              <SheetTitle>
                {activeSheet.accountId ? '编辑账号' : '新增账号'}
              </SheetTitle>
              <SheetDescription>
                账号主体维护账号名、主平台、属性、置信度、密码和状态，注册源与财富等补充信息可在详情抽屉中继续维护。
              </SheetDescription>
            </SheetHeader>
            <form className='mt-6 space-y-4' onSubmit={handleAccountSubmit}>
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
                  <SelectTrigger>
                    <SelectValue placeholder='请选择平台' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='none'>暂不绑定</SelectItem>
                    {platforms.map((platform) => (
                      <SelectItem key={platform.id} value={String(platform.id)}>
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
                />
              </div>

              <div className='grid gap-4 md:grid-cols-2'>
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
                    <SelectTrigger>
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
                    <SelectTrigger>
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

              <div className='grid gap-4 md:grid-cols-2'>
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
                      activeSheet.accountId
                        ? '留空表示保持原密码'
                        : '可选，保存后按 MD5 入库'
                    }
                  />
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
                  />
                </div>
              </div>

              <div className='grid gap-2'>
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='available'>可用</SelectItem>
                    <SelectItem value='banned'>封禁</SelectItem>
                    <SelectItem value='cancelled'>已注销</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='flex items-center justify-end gap-2 pt-2'>
                <Button type='button' variant='outline' onClick={closeSheet}>
                  取消
                </Button>
                <Button type='submit' disabled={submitPending}>
                  {submitPending
                    ? '保存中...'
                    : activeSheet.accountId
                      ? '保存修改'
                      : '创建账号'}
                </Button>
              </div>
            </form>
          </>
        );

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
                <Table>
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

      case 'keys':
        return (
          <>
            <SheetHeader>
              <SheetTitle>密钥信息</SheetTitle>
              <SheetDescription>
                已存在的密钥可复制内容，支持新增、编辑和删除。
              </SheetDescription>
            </SheetHeader>
            <div className='mt-6 grid gap-6'>
              <div className='space-y-3'>
                {selectedAccountDetail?.keys.map((key) => (
                  <div key={key.id} className='rounded-lg border p-4'>
                    <div className='flex items-start justify-between gap-3'>
                      <div className='space-y-1'>
                        <div className='font-medium'>{key.title}</div>
                        <div className='text-muted-foreground text-sm'>
                          过期时间：{formatDateTimeLabel(key.expiresAt)}
                        </div>
                      </div>
                      <div className='flex gap-2'>
                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          onClick={() =>
                            void handleCopy(key.content, '密钥内容')
                          }
                        >
                          <Copy className='mr-1 size-4' />
                          复制
                        </Button>
                        {access.canUpdate ? (
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={() => beginEditKey(key)}
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
                                type: 'key',
                                ids: [key.id],
                                label: key.title
                              })
                            }
                          >
                            删除
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className='bg-muted mt-3 rounded-md p-3 text-sm break-all'>
                      {key.content}
                    </div>
                  </div>
                ))}
                {!selectedAccountDetail?.keys.length ? (
                  <div className='text-muted-foreground rounded-lg border border-dashed px-4 py-10 text-center text-sm'>
                    当前还没有密钥信息。
                  </div>
                ) : null}
              </div>

              {canManageNested ? (
                <form
                  className='space-y-4 rounded-lg border p-4'
                  onSubmit={handleKeySubmit}
                >
                  <div className='font-medium'>
                    {editingKeyId ? '编辑密钥' : '新增密钥'}
                  </div>
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
                      rows={5}
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
                    />
                  </div>
                  <div className='flex items-center justify-end gap-2'>
                    {editingKeyId ? (
                      <Button
                        type='button'
                        variant='outline'
                        onClick={() => {
                          setKeyForm(createDefaultKeyForm());
                          setEditingKeyId(null);
                        }}
                      >
                        取消编辑
                      </Button>
                    ) : null}
                    <Button type='submit' disabled={submitPending}>
                      {submitPending
                        ? '提交中...'
                        : editingKeyId
                          ? '保存修改'
                          : '新增密钥'}
                    </Button>
                  </div>
                </form>
              ) : null}
            </div>
          </>
        );

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
                <Table>
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

      case 'securities':
        return (
          <>
            <SheetHeader>
              <SheetTitle>密保信息</SheetTitle>
              <SheetDescription>
                支持问题验证、2FA验证、联系人和紧急邮箱，多条密保信息可并存。
              </SheetDescription>
            </SheetHeader>
            <div className='mt-6 grid gap-6'>
              <div className='space-y-3'>
                {selectedAccountDetail?.securities.map((security) => (
                  <div key={security.id} className='rounded-lg border p-4'>
                    <div className='flex items-start justify-between gap-3'>
                      <div>
                        <div className='font-medium'>
                          {getSecurityTypeLabel(security.securityType)}
                        </div>
                        <div className='text-muted-foreground text-sm'>
                          更新时间：{formatDateTimeLabel(security.updatedAt)}
                        </div>
                      </div>
                      <div className='flex gap-2'>
                        {access.canUpdate ? (
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={() => beginEditSecurity(security)}
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
                                type: 'security',
                                ids: [security.id],
                                label: getSecurityTypeLabel(
                                  security.securityType
                                )
                              })
                            }
                          >
                            删除
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className='bg-muted mt-3 rounded-md p-3 text-sm whitespace-pre-wrap'>
                      {security.content}
                    </div>
                  </div>
                ))}
                {!selectedAccountDetail?.securities.length ? (
                  <div className='text-muted-foreground rounded-lg border border-dashed px-4 py-10 text-center text-sm'>
                    当前还没有密保信息。
                  </div>
                ) : null}
              </div>

              {canManageNested ? (
                <form
                  className='space-y-4 rounded-lg border p-4'
                  onSubmit={handleSecuritySubmit}
                >
                  <div className='font-medium'>
                    {editingSecurityId ? '编辑密保' : '新增密保'}
                  </div>
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='question'>问题验证</SelectItem>
                      <SelectItem value='two_factor'>2FA验证</SelectItem>
                      <SelectItem value='contact'>联系人</SelectItem>
                      <SelectItem value='emergency_email'>紧急邮箱</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={securityForm.content}
                    onChange={(event) =>
                      setSecurityForm((current) => ({
                        ...current,
                        content: event.target.value
                      }))
                    }
                    rows={6}
                    placeholder='请输入明文密保内容'
                  />
                  <div className='flex items-center justify-end gap-2'>
                    {editingSecurityId ? (
                      <Button
                        type='button'
                        variant='outline'
                        onClick={() => {
                          setSecurityForm(createDefaultSecurityForm());
                          setEditingSecurityId(null);
                        }}
                      >
                        取消编辑
                      </Button>
                    ) : null}
                    <Button type='submit' disabled={submitPending}>
                      {submitPending
                        ? '提交中...'
                        : editingSecurityId
                          ? '保存修改'
                          : '新增密保'}
                    </Button>
                  </div>
                </form>
              ) : null}
            </div>
          </>
        );

      case 'wealth':
        return (
          <>
            <SheetHeader>
              <SheetTitle>财富详情</SheetTitle>
              <SheetDescription>
                展示时采用“标题：内容”格式，编辑时改为可维护的键值对。
              </SheetDescription>
            </SheetHeader>
            <div className='mt-6 grid gap-6'>
              <div className='rounded-lg border p-4'>
                <div className='mb-3 font-medium'>当前展示</div>
                <div className='space-y-2 text-sm'>
                  {selectedAccountDetail?.wealthEntries.length ? (
                    selectedAccountDetail.wealthEntries.map((entry) => (
                      <div key={entry.key}>
                        <span className='font-medium'>{entry.key}：</span>
                        <span className='text-muted-foreground'>
                          {entry.value}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className='text-muted-foreground'>
                      当前还没有财富信息。
                    </div>
                  )}
                </div>
              </div>

              {canManageNested ? (
                <div className='space-y-4 rounded-lg border p-4'>
                  <div className='font-medium'>编辑财富信息</div>
                  {wealthDrafts.map((entry, index) => (
                    <div
                      key={index}
                      className='grid gap-3 rounded-md border p-3 md:grid-cols-2'
                    >
                      <Input
                        value={entry.key}
                        onChange={(event) =>
                          setWealthDrafts((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, key: event.target.value }
                                : item
                            )
                          )
                        }
                        placeholder='标题'
                      />
                      <div className='flex gap-2'>
                        <Input
                          value={entry.value}
                          onChange={(event) =>
                            setWealthDrafts((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, value: event.target.value }
                                  : item
                              )
                            )
                          }
                          placeholder='内容'
                        />
                        {wealthDrafts.length > 1 ? (
                          <Button
                            type='button'
                            variant='outline'
                            onClick={() =>
                              setWealthDrafts((current) =>
                                current.filter(
                                  (_, itemIndex) => itemIndex !== index
                                )
                              )
                            }
                          >
                            删除
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  <div className='flex items-center justify-between'>
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() =>
                        setWealthDrafts((current) => [
                          ...current,
                          { key: '', value: '' }
                        ])
                      }
                    >
                      <Plus className='mr-1 size-4' />
                      新增一项
                    </Button>
                    <Button
                      disabled={submitPending}
                      onClick={() => void handleWealthSave()}
                    >
                      {submitPending ? '保存中...' : '保存财富信息'}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </>
        );

      case 'closed':
        return null;
    }
  }

  if (!workspaceId) {
    return (
      <Card>
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
      <Card>
        <CardHeader className='flex flex-col gap-4'>
          <div>
            <CardTitle>账号列表</CardTitle>
            <CardDescription>
              账号管理承接主平台、密钥、绑定关系、注册源、密保和财富信息，支持按工作区独立维护。
            </CardDescription>
          </div>
          <form className='flex flex-col gap-3' onSubmit={handleSearchSubmit}>
            <div className='flex flex-1 flex-wrap items-center gap-2'>
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
                className='min-w-[320px] flex-[2_1_420px] rounded-xl px-4'
              />
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as typeof statusFilter);
                  setPage(1);
                }}
              >
                <SelectTrigger className='min-w-[150px] rounded-xl'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>全部状态</SelectItem>
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
                <SelectTrigger className='min-w-[150px] rounded-xl'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>全部属性</SelectItem>
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
                <SelectTrigger className='min-w-[150px] rounded-xl'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>全部置信度</SelectItem>
                  <SelectItem value='very_high'>极高</SelectItem>
                  <SelectItem value='high'>高</SelectItem>
                  <SelectItem value='medium'>中</SelectItem>
                  <SelectItem value='low'>低</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                  onClick={() => void openAccountEditor()}
                  onMouseUp={(event) => event.currentTarget.blur()}
                >
                  新增
                </Button>
              ) : null}
            </div>
          </form>
        </CardHeader>
        <CardContent>
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>平台 Icon</TableHead>
                  <TableHead>平台</TableHead>
                  <TableHead>账号</TableHead>
                  <TableHead>属性</TableHead>
                  <TableHead>置信度</TableHead>
                  <TableHead>密钥</TableHead>
                  <TableHead>绑定信息</TableHead>
                  <TableHead>注册源</TableHead>
                  <TableHead>密码</TableHead>
                  <TableHead>密保</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>财富</TableHead>
                  <TableHead>注册时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <PlatformIcon
                        iconUrl={account.platformIconUrl}
                        name={account.platformName}
                      />
                    </TableCell>
                    <TableCell>
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
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        <span>{account.account}</span>
                        <Button
                          type='button'
                          variant='outline'
                          size='icon'
                          className='size-7'
                          onClick={() =>
                            void handleCopy(account.account, '账号')
                          }
                        >
                          <Copy className='size-4' />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant='outline'>
                        {getAccountAttributeLabel(account.attribute)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant='outline'>
                        {getAccountConfidenceLabel(account.confidence)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ActionLinkButton
                        disabled={!canManageNested}
                        onClick={() => void openAccountSheet('keys', account)}
                      >
                        {account.keyCount
                          ? `详情（${account.keyCount}）`
                          : '添加'}
                      </ActionLinkButton>
                    </TableCell>
                    <TableCell>
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
                    <TableCell className='max-w-xs'>
                      {account.registrationSources.length ? (
                        <div className='flex flex-wrap gap-2'>
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
                    <TableCell>
                      {account.hasPassword ? '已加密存储' : '未设置'}
                    </TableCell>
                    <TableCell>
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
                    <TableCell>
                      <Badge variant='outline'>
                        {getAccountStatusLabel(account.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ActionLinkButton
                        disabled={!canManageNested}
                        onClick={() => void openAccountSheet('wealth', account)}
                      >
                        {account.wealthEntries.length ? '详情' : '补充信息'}
                      </ActionLinkButton>
                    </TableCell>
                    <TableCell>
                      {formatDateTimeLabel(account.registeredAt)}
                    </TableCell>
                    <TableCell>
                      <div className='flex gap-2'>
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
                      colSpan={14}
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
