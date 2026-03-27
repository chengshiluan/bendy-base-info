'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  collectPermissionIds,
  filterPermissionTree,
  flattenPermissionTree
} from '@/lib/platform/permission-tree';
import type { PermissionTreeNode } from '@/lib/platform/types';
import { cn } from '@/lib/utils';

interface PermissionTreeSelectorProps {
  tree: PermissionTreeNode[];
  value: string[];
  onChange: (value: string[]) => void;
  emptyLabel?: string;
  heightClassName?: string;
}

function getExpandableCodes(nodes: PermissionTreeNode[]) {
  return flattenPermissionTree(nodes)
    .filter((node) => node.children.length)
    .map((node) => node.code);
}

function getDefaultExpandedCodes(nodes: PermissionTreeNode[]) {
  return nodes.filter((node) => node.children.length).map((node) => node.code);
}

function isOrphanActionRoot(node: PermissionTreeNode) {
  return (
    node.permissionType === 'action' &&
    !node.parentCode &&
    node.children.length === 0
  );
}

export function PermissionTreeSelector({
  tree,
  value,
  onChange,
  emptyLabel = '当前还没有可绑定的权限。',
  heightClassName = 'h-80'
}: PermissionTreeSelectorProps) {
  const [keyword, setKeyword] = useState('');
  const [expandedCodes, setExpandedCodes] = useState<string[]>(() =>
    getDefaultExpandedCodes(tree)
  );
  const [legacySectionOpen, setLegacySectionOpen] = useState(false);
  const selectedIds = useMemo(() => new Set(value), [value]);

  useEffect(() => {
    setExpandedCodes(getDefaultExpandedCodes(tree));
  }, [tree]);

  const filteredTree = useMemo(
    () => filterPermissionTree(tree, keyword),
    [keyword, tree]
  );
  const legacyRoots = useMemo(
    () => tree.filter((node) => isOrphanActionRoot(node)),
    [tree]
  );
  const structuredTree = useMemo(
    () => filteredTree.filter((node) => !isOrphanActionRoot(node)),
    [filteredTree]
  );
  const legacyTree = useMemo(
    () => filteredTree.filter((node) => isOrphanActionRoot(node)),
    [filteredTree]
  );

  if (!tree.length) {
    return (
      <div className='text-muted-foreground rounded-md border border-dashed p-3 text-sm'>
        {emptyLabel}
      </div>
    );
  }

  const expandedSet = new Set(expandedCodes);
  const visibleExpandableCodes = getExpandableCodes(filteredTree);
  const selectedLegacyCount = legacyRoots.filter((node) =>
    selectedIds.has(node.id)
  ).length;
  const shouldShowLegacySection = Boolean(legacyTree.length);
  const legacySectionExpanded =
    Boolean(keyword.trim()) || legacySectionOpen || !structuredTree.length;

  const toggleExpanded = (code: string) => {
    setExpandedCodes((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code]
    );
  };

  const applyNodeSelection = (
    node: PermissionTreeNode,
    nextChecked: boolean | 'indeterminate'
  ) => {
    const checked = nextChecked === true;
    const nextSelection = new Set(value);

    collectPermissionIds(node).forEach((permissionId) => {
      if (checked) {
        nextSelection.add(permissionId);
        return;
      }

      nextSelection.delete(permissionId);
    });

    onChange(Array.from(nextSelection));
  };

  const getNodeCheckedState = (node: PermissionTreeNode) => {
    const permissionIds = collectPermissionIds(node);
    const checkedCount = permissionIds.filter((id) =>
      selectedIds.has(id)
    ).length;

    if (checkedCount === 0) {
      return false;
    }

    if (checkedCount === permissionIds.length) {
      return true;
    }

    return 'indeterminate' as const;
  };

  const renderNode = (node: PermissionTreeNode, depth = 0) => {
    const checkedState = getNodeCheckedState(node);
    const hasChildren = node.children.length > 0;
    const isExpanded = keyword ? true : expandedSet.has(node.code);

    return (
      <div key={node.id} className='space-y-1'>
        <div
          className={cn(
            'hover:bg-muted/40 flex items-start gap-3 rounded-md px-2 py-2 text-sm',
            depth > 0 && 'border-l border-dashed'
          )}
          style={{ marginLeft: depth * 18 }}
        >
          <button
            type='button'
            className='text-muted-foreground mt-0.5 flex size-4 items-center justify-center'
            onClick={() => {
              if (hasChildren) {
                toggleExpanded(node.code);
              }
            }}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className='size-4' />
              ) : (
                <ChevronRight className='size-4' />
              )
            ) : null}
          </button>
          <Checkbox
            checked={checkedState}
            onCheckedChange={(nextChecked) =>
              applyNodeSelection(node, nextChecked)
            }
            className='mt-0.5'
          />
          <div className='min-w-0 flex-1 space-y-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <span className='font-medium'>{node.name}</span>
              <Badge variant='outline'>
                {node.permissionType === 'menu' ? '菜单' : '按钮'}
              </Badge>
              {node.isSystem ? <Badge variant='secondary'>系统</Badge> : null}
            </div>
            <div className='text-muted-foreground text-xs break-all'>
              {node.code}
            </div>
            {node.route ? (
              <div className='text-muted-foreground text-xs'>{node.route}</div>
            ) : null}
          </div>
        </div>

        {hasChildren && isExpanded ? (
          <div className='space-y-1'>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className='space-y-3'>
      <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
        <div className='relative flex-1'>
          <Search className='text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2' />
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder='搜索菜单名、权限编码、路由'
            className='pl-9'
          />
        </div>
        <div className='flex gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => setExpandedCodes(visibleExpandableCodes)}
          >
            全部展开
          </Button>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => setExpandedCodes([])}
            disabled={Boolean(keyword)}
          >
            全部收起
          </Button>
        </div>
      </div>

      <ScrollArea className={cn('rounded-md border', heightClassName)}>
        <div className='space-y-1 p-3'>
          {structuredTree.length ? (
            structuredTree.map((node) => renderNode(node))
          ) : (
            <div className='text-muted-foreground py-8 text-center text-sm'>
              {shouldShowLegacySection
                ? '当前菜单树里没有匹配节点，请查看下方历史 / 未归类权限。'
                : '没有匹配的权限节点。'}
            </div>
          )}

          {shouldShowLegacySection ? (
            <div className='mt-3 rounded-md border border-dashed'>
              <button
                type='button'
                className='flex w-full items-center justify-between gap-3 px-3 py-2 text-left'
                onClick={() => setLegacySectionOpen((current) => !current)}
              >
                <div className='min-w-0'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <span className='text-sm font-medium'>
                      历史 / 未归类权限
                    </span>
                    <Badge variant='secondary'>{legacyTree.length}</Badge>
                    {selectedLegacyCount ? (
                      <Badge variant='outline'>
                        已选 {selectedLegacyCount}
                      </Badge>
                    ) : null}
                  </div>
                  <p className='text-muted-foreground mt-1 text-xs'>
                    这里收纳的是没有挂到当前菜单树上的旧权限或独立权限，避免干扰主权限树。
                  </p>
                </div>
                {legacySectionExpanded ? (
                  <ChevronDown className='text-muted-foreground size-4 shrink-0' />
                ) : (
                  <ChevronRight className='text-muted-foreground size-4 shrink-0' />
                )}
              </button>

              {legacySectionExpanded ? (
                <div className='border-t p-3 pt-2'>
                  <div className='space-y-1'>
                    {legacyTree.map((node) => renderNode(node))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
