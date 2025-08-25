
"use client";
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useUserRole } from '@/hooks/use-user-role';
import { useSettings } from '@/hooks/use-settings';
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Boxes, ShoppingCart, Users, UserCog, LogOut, ClipboardList, Store, BookUser, Hammer, History, Briefcase, MapPin, Truck, Images, DollarSign, Target, BarChart3, Package, Receipt, Settings, Database, Percent, FileText, UserCheck, TrendingUp, CreditCard, HardDrive, Camera } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import React, { useEffect } from 'react';
import Image from 'next/image';
import { ROLE_LABELS } from '@/types/user-role';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const { userRole, loading: roleLoading } = useUserRole();
  const { settings } = useSettings();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // 설정에서 사이트명을 가져와서 브라우저 탭 제목 설정
  useEffect(() => {
    if (settings?.siteName) {
      document.title = settings.siteName;
    }
  }, [settings?.siteName]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  if (loading || roleLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  const getRoleDisplayName = () => {
    if (user.isAnonymous) return '익명 사용자';
    if (userRole) {
      // 실제 사용자 권한과 소속 표시
      const roleLabel = userRole.branchName || '메인매장';
      return roleLabel;
    }
    return '메인매장';
  };

  const getRoleDisplay = () => {
    if (user.isAnonymous) return '익명 사용자';
    if (user) {
      // 실제 사용자 권한 표시 (단독매장이므로 소속 불필요)
      return user.role || '직원';
    }
    return '직원';
  };

  const getMenuItem = (menuKey: string) => {
    const menuConfig = settings?.menuSettings?.[menuKey];
    if (!menuConfig) return null;

    let icon: React.ReactNode = null;
    let href = `/dashboard/${menuKey}`;
    
    switch (menuKey) {
      case 'dashboard':
        icon = <LayoutDashboard className="h-4 w-4" />;
        href = '/dashboard';
        break;
      case 'orders/new':
        icon = <ShoppingCart className="h-4 w-4" />;
        href = '/dashboard/orders/new';
        break;
      case 'orders':
        icon = <ClipboardList className="h-4 w-4" />;
        break;
      case 'customers':
        icon = <Users className="h-4 w-4" />;
        break;
      case 'products':
        icon = <Boxes className="h-4 w-4" />;
        break;
      case 'materials':
        icon = <Package className="h-4 w-4" />;
        break;
      case 'pickup-delivery':
        icon = <Truck className="h-4 w-4" />;
        break;
      case 'delivery-fees':
        icon = <MapPin className="h-4 w-4" />;
        break;
      case 'recipients':
        icon = <BookUser className="h-4 w-4" />;
        break;
      case 'simple-expenses':
        icon = <DollarSign className="h-4 w-4" />;
        break;
      case 'partners':
        icon = <Briefcase className="h-4 w-4" />;
        break;
      case 'sample-albums':
        icon = <Images className="h-4 w-4" />;
        break;
      case 'reports':
        icon = <FileText className="h-4 w-4" />;
        break;
      case 'budgets':
        icon = <CreditCard className="h-4 w-4" />;
        break;
      case 'hr':
        icon = <UserCheck className="h-4 w-4" />;
        break;
      case 'users':
        icon = <UserCog className="h-4 w-4" />;
        break;
      case 'stock-history':
        icon = <History className="h-4 w-4" />;
        break;
      case 'settings':
        icon = <Settings className="h-4 w-4" />;
        break;
      default:
        icon = null;
    }

    return {
      href: href,
      label: menuConfig.label,
      icon: icon,
    };
  };

  return (
    <SidebarProvider defaultOpen={true}>
        <Sidebar className="no-print">
            <SidebarHeader className="p-4">
                <div className="flex items-center justify-center">
                    <Image 
                      src={settings?.brandLogo || "https://ecimg.cafe24img.com/pg1472b45444056090/lilymagflower/web/upload/category/logo/v2_d13ecd48bab61a0269fab4ecbe56ce07_lZMUZ1lORo_top.jpg"} 
                      alt="Logo" 
                      width={150} 
                      height={40} 
                      className="w-36 h-auto"
                      priority 
                    />
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarMenu>
                    {(() => {
                      const menuSettings = settings?.menuSettings;
                      if (!menuSettings || Object.keys(menuSettings).length === 0) {
                        // 기본 메뉴 설정이 없을 때 기본 메뉴 표시
                        const defaultMenus = [
                          { key: 'dashboard', label: '대시보드', href: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
                          { key: 'orders/new', label: '주문접수', href: '/dashboard/orders/new', icon: <ShoppingCart className="h-4 w-4" /> },
                          { key: 'orders', label: '주문현황', href: '/dashboard/orders', icon: <ClipboardList className="h-4 w-4" /> },
                          { key: 'customers', label: '고객관리', href: '/dashboard/customers', icon: <Users className="h-4 w-4" /> },
                          { key: 'products', label: '상품관리', href: '/dashboard/products', icon: <Boxes className="h-4 w-4" /> },
                          { key: 'materials', label: '자재관리', href: '/dashboard/materials', icon: <Package className="h-4 w-4" /> },
                          { key: 'pickup-delivery', label: '픽업/배송', href: '/dashboard/pickup-delivery', icon: <Truck className="h-4 w-4" /> },
                          { key: 'delivery-fees', label: '배송비 설정', href: '/dashboard/delivery-fees', icon: <MapPin className="h-4 w-4" /> },
                          { key: 'recipients', label: '수령자관리', href: '/dashboard/recipients', icon: <BookUser className="h-4 w-4" /> },
                          { key: 'simple-expenses', label: '지출관리', href: '/dashboard/simple-expenses', icon: <DollarSign className="h-4 w-4" /> },
                          { key: 'partners', label: '거래처관리', href: '/dashboard/partners', icon: <Briefcase className="h-4 w-4" /> },
                          { key: 'sample-albums', label: '샘플앨범', href: '/dashboard/sample-albums', icon: <Images className="h-4 w-4" /> },
                          { key: 'reports', label: '리포트분석', href: '/dashboard/reports', icon: <FileText className="h-4 w-4" /> },
                          { key: 'budgets', label: '예산관리', href: '/dashboard/budgets', icon: <CreditCard className="h-4 w-4" /> },
                          { key: 'hr', label: '인사관리', href: '/dashboard/hr', icon: <UserCheck className="h-4 w-4" /> },
                          { key: 'users', label: '사용자관리', href: '/dashboard/users', icon: <UserCog className="h-4 w-4" /> },
                          { key: 'stock-history', label: '재고변동기록', href: '/dashboard/stock-history', icon: <History className="h-4 w-4" /> },
                          { key: 'settings', label: '설정', href: '/dashboard/settings', icon: <Settings className="h-4 w-4" /> },
                        ];
                        
                        return defaultMenus.map((menu) => (
                          <SidebarMenuItem key={menu.key}>
                            <SidebarMenuButton asChild>
                                <a href={menu.href}>
                                    {menu.icon}
                                    <span>{menu.label}</span>
                                </a>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ));
                      }
                      
                      // 설정된 메뉴 표시
                      return Object.entries(menuSettings)
                        .sort(([,a], [,b]) => a.order - b.order)
                        .filter(([, config]) => config.visible)
                        .map(([menuKey, config]) => {
                          const menuItem = getMenuItem(menuKey);
                          if (!menuItem) return null;
                          
                          return (
                            <SidebarMenuItem key={menuKey}>
                              <SidebarMenuButton asChild>
                                  <a href={menuItem.href}>
                                      {menuItem.icon}
                                      <span>{menuItem.label}</span>
                                  </a>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        });
                    })()}
                </SidebarMenu>
            </SidebarContent>
            <SidebarFooter className="p-4">
                <div className="flex items-center gap-2 mb-4">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={user.photoURL || undefined} />
                        <AvatarFallback>{user.displayName?.[0] || user.email?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                                         <div className="flex-1 min-w-0">
                         <p className="text-sm font-medium truncate">{user.displayName || user.email}</p>
                         <p className="text-xs text-muted-foreground truncate">{getRoleDisplay()}</p>
                     </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleLogout} className="w-full">
                    <LogOut className="h-4 w-4 mr-2" />
                    로그아웃
                </Button>
            </SidebarFooter>
        </Sidebar>
        <div className="flex-1 flex flex-col">
            <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex h-14 items-center gap-2 px-4">
                    <SidebarTrigger className="-ml-1" />
                    <div className="flex-1" />
                </div>
            </header>
            <main className="flex-1 overflow-auto">
                {children}
            </main>
        </div>
    </SidebarProvider>
  );
}
