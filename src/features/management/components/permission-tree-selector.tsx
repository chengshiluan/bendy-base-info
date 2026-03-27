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

export function PermissionTreeSelector({
  tree,
  value,
  onChange,
  emptyLabel = '当前还没有可绑定的权限。',
  heightClassName = 'h-80'
}: PermissionTreeSelectorProps) {
  const [keyword, setKeyword] = useState('');
  const [expandedCodes, setExpandedCodes] = useState<string[]>(() =>
    getExpandableCodes(tree)
  );
  const selectedIds = useMemo(() => new Set(value), [value]);

  useEffect(() => {
    setExpandedCodes(getExpandableCodes(tree));
  }, [tree]);

  const filteredTree = useMemo(
    () => filterPermissionTree(tree, keyword),
    [keyword, tree]
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
          {filteredTree.length ? (
            filteredTree.map((node) => renderNode(node))
          ) : (
            <div className='text-muted-foreground py-8 text-center text-sm'>
              没有匹配的权限节点。
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
