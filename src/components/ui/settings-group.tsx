"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  SettingsGroup — 區段標題 + 群組化卡片容器                                     */
/* -------------------------------------------------------------------------- */

type SettingsGroupProps = React.HTMLAttributes<HTMLDivElement> & {
  /** 區段標題 (例如 "偏好設定"、"帳號") */
  title?: string;
  /** 區段標題旁的描述文字 (可選) */
  description?: string;
};

/**
 * 用於將多個 SettingsItem 包成同一個圓角卡片容器，
 * 每個項目之間以分隔線區隔，呈現 iOS-style 分組列表風格。
 */
export function SettingsGroup({
  title,
  description,
  className,
  children,
  ...rest
}: SettingsGroupProps) {
  return (
    <section className={cn("flex flex-col gap-2", className)} {...rest}>
      {title || description ? (
        <header className="flex items-baseline justify-between px-4">
          {title ? (
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {title}
            </h2>
          ) : null}
          {description ? (
            <p className="text-[11px] text-slate-400">{description}</p>
          ) : null}
        </header>
      ) : null}

      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm",
          // iOS-style 分組卡片
          "divide-y divide-slate-100"
        )}
      >
        {children}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  SettingsItem — 列表項目                                                    */
/* -------------------------------------------------------------------------- */

type CommonProps = {
  /** 顯示於左側的 icon (必須由 caller 帶 className 控制顏色/大小) */
  icon?: React.ReactNode;
  /** 主標題 */
  title: React.ReactNode;
  /** 副標題 (選填) */
  subtitle?: React.ReactNode;
  /** 右側顯示的文字 (例如語言值) */
  trailing?: React.ReactNode;
  /** 是否隱藏右側箭頭 (預設顯示) */
  hideChevron?: boolean;
  /** 危險動作 (登出等) — 紅色強調 */
  destructive?: boolean;
  /** 額外內容，會在標題下方渲染 (例如 toggle) */
  children?: React.ReactNode;
  /** 額外 className */
  className?: string;
};

type ButtonItemProps = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title" | "className"> & {
    href?: undefined;
  };

type LinkItemProps = CommonProps & {
  href: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  disabled?: boolean;
};

type SettingsItemProps = ButtonItemProps | LinkItemProps;

const baseClasses =
  "group flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50";

/**
 * SettingsItem: 一列設定項目，左邊可放 icon，中間是標題與副標題，右邊可放值/箭頭。
 * 支援 button (onClick) 與 Link (href) 兩種渲染方式。
 */
export function SettingsItem(props: SettingsItemProps) {
  const {
    icon,
    title,
    subtitle,
    trailing,
    hideChevron = false,
    destructive = false,
    children,
    className,
    ...rest
  } = props as SettingsItemProps & Record<string, unknown>;

  const inner = (
    <>
      {icon ? (
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
            destructive
              ? "bg-red-50 text-red-600"
              : "bg-slate-100 text-slate-700 group-hover:bg-slate-900 group-hover:text-white"
          )}
        >
          {icon}
        </span>
      ) : null}

      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "truncate text-[15px] font-medium",
            destructive ? "text-red-600" : "text-slate-900"
          )}
        >
          {title}
        </span>
        {subtitle ? (
          <span className="truncate text-[12px] text-slate-500">{subtitle}</span>
        ) : null}
      </span>

      {children ? <span className="flex shrink-0 items-center">{children}</span> : null}

      {trailing ? (
        <span className="ml-1 shrink-0 text-[13px] text-slate-500">{trailing}</span>
      ) : null}

      {!hideChevron ? (
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5",
            destructive ? "text-red-400" : "text-slate-300"
          )}
        />
      ) : null}
    </>
  );

  const combined = cn(baseClasses, className);

  if ("href" in props && props.href) {
    const { onClick: anchorOnClick } = props;
    return (
      <Link href={props.href} className={combined} onClick={anchorOnClick}>
        {inner}
      </Link>
    );
  }

  // 移除衝突的 prop，再把剩餘屬性轉交 button
  const buttonRest = rest as Omit<
    ButtonItemProps,
    "icon" | "title" | "subtitle" | "trailing" | "hideChevron" | "destructive" | "children" | "className" | "href"
  >;
  return (
    <button type="button" className={combined} {...buttonRest}>
      {inner}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  SettingsToggle — iOS 風格 Switch                                           */
/* -------------------------------------------------------------------------- */

type SettingsToggleProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
};

/**
 * 純 CSS 實作的 iOS-style 開關，不依賴任何外部套件。
 */
export function SettingsToggle({ checked, onChange, disabled, ariaLabel }: SettingsToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-slate-900" : "bg-slate-300",
        disabled && "opacity-50"
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  ProfileHeaderCard — 個人資料頭像卡片                                        */
/* -------------------------------------------------------------------------- */

type ProfileHeaderCardProps = {
  /** 頭像顯示文字 (例如姓名首字) */
  avatarText?: string;
  /** 姓名 */
  name: React.ReactNode;
  /** 副標題 (例如電話 / 角色) */
  subtitle?: React.ReactNode;
  /** 右側動作 (例如「編輯」按鈕) */
  action?: React.ReactNode;
  /** 額外 className */
  className?: string;
};

/**
 * 個人資料頁頭像卡片：圓形大頭像 + 姓名 + 副標題 + 右側動作按鈕。
 */
export function ProfileHeaderCard({
  avatarText,
  name,
  subtitle,
  action,
  className,
}: ProfileHeaderCardProps) {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-4 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm",
        className
      )}
    >
      <div className="relative">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-slate-900 to-slate-700 text-xl font-bold text-white shadow-lg">
          {avatarText ?? "?"}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[17px] font-semibold text-slate-900">{name}</span>
        {subtitle ? (
          <span className="truncate text-[13px] text-slate-500">{subtitle}</span>
        ) : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
