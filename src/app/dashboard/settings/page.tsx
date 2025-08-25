"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useUserRole } from "@/hooks/use-user-role";
import { 
  Settings, 
  Building, 
  Truck, 
  Globe, 
  Database, 
  Bell,
  Save,
  RefreshCw,
  MessageSquare,
  Mail,
  Type,
  Percent,
  Trash2,
  AlertTriangle,
  Camera,
  Upload,
  X,
  Search,
  Menu,
  Eye,
  EyeOff,
  GripVertical,
  Move
} from "lucide-react";
import { useSettings, defaultSettings } from "@/hooks/use-settings";
import { useDataCleanup } from "@/hooks/use-data-cleanup";
import BackupManagement from "./components/backup-management";
import { EmailTemplateEditor } from "@/components/email-template-editor";
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { uploadToGooglePhotos, deleteFromGooglePhotos } from '@/lib/google-photos-service';

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'general';
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const { settings, loading, error, saveSettings } = useSettings();
  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [newFont, setNewFont] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isHQManager } = useUserRole();
  const { loading: cleanupLoading, progress, cleanupAllData, cleanupSpecificData } = useDataCleanup();
  const [selectedDataType, setSelectedDataType] = useState<string>('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);

  // 드래그 앤 드롭 함수들
  const handleDragStart = (e: React.DragEvent, menuKey: string) => {
    setDraggedItem(menuKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, menuKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (menuKey !== draggedItem) {
      setDragOverItem(menuKey);
    }
  };

  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  const handleDrop = (e: React.DragEvent, targetMenuKey: string) => {
    e.preventDefault();
    console.log('Drop event triggered:', { draggedItem, targetMenuKey });
    
    if (!draggedItem || draggedItem === targetMenuKey) {
      console.log('Drop cancelled: invalid items');
      return;
    }

    setLocalSettings(prev => {
      const menuSettings = prev.menuSettings || defaultSettings.menuSettings;
      console.log('Current menu settings:', menuSettings);
      
      // 현재 순서대로 메뉴 아이템들을 배열로 변환
      const menuItems = Object.entries(menuSettings)
        .sort(([,a], [,b]) => a.order - b.order)
        .map(([key, config]) => ({ key, ...config }));
      
      // 드래그된 아이템의 인덱스 찾기
      const draggedIndex = menuItems.findIndex(item => item.key === draggedItem);
      // 타겟 아이템의 인덱스 찾기
      const targetIndex = menuItems.findIndex(item => item.key === targetMenuKey);
      
      console.log('Indices:', { draggedIndex, targetIndex });
      
      if (draggedIndex === -1 || targetIndex === -1) {
        console.log('Invalid indices found');
        return prev;
      }
      
      // 드래그된 아이템을 제거하고 타겟 위치에 삽입
      const [draggedItemData] = menuItems.splice(draggedIndex, 1);
      menuItems.splice(targetIndex, 0, draggedItemData);
      
      // 새로운 순서로 메뉴 설정 객체 생성
      const newMenuSettings = {};
      menuItems.forEach((item, index) => {
        newMenuSettings[item.key] = {
          visible: item.visible,
          order: index + 1,
          label: item.label
        };
      });
      
      console.log('New menu settings:', newMenuSettings);
      
      return {
        ...prev,
        menuSettings: newMenuSettings
      };
    });

    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  // Google Photos URL에서 mediaItemId 추출
  const extractMediaItemId = (url: string): string | null => {
    try {
      // Google Photos 공유 URL에서 mediaItemId 추출
      const match = url.match(/\/media\/([^\/\?]+)/);
      return match ? match[1] : null;
    } catch (error) {
      console.warn('Failed to extract mediaItemId from URL:', error);
      return null;
    }
  };

  // 파일 업로드 함수 (Google Photos 사용)
  const uploadFile = async (file: File, path: string): Promise<string> => {
    try {
      // Google Photos에 업로드 시도
      const fileName = path.split('/').pop() || file.name;
      return await uploadToGooglePhotos(file, fileName);
    } catch (error) {
      console.warn('Google Photos upload failed, falling back to Firebase:', error);
      // Google Photos 실패 시 Firebase Storage로 fallback
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
    }
  };

  // 로고 업로드 처리
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 파일 타입 검증
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '이미지 파일만 업로드할 수 있습니다.'
      });
      return;
    }

    // 파일 크기 검증 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '파일 크기는 5MB 이하여야 합니다.'
      });
      return;
    }

    try {
      setUploadingLogo(true);
      
      // 기존 로고 삭제
      if (localSettings.brandLogo) {
        try {
          if (localSettings.brandLogo.includes('firebasestorage')) {
            const oldLogoRef = ref(storage, localSettings.brandLogo);
            await deleteObject(oldLogoRef);
          } else if (localSettings.brandLogo.includes('googleusercontent.com')) {
            // Google Photos에서 삭제 (mediaItemId 추출 필요)
            const mediaItemId = extractMediaItemId(localSettings.brandLogo);
            if (mediaItemId) {
              await deleteFromGooglePhotos(mediaItemId);
            }
          }
        } catch (error) {
          console.log('기존 로고 삭제 실패 (무시됨):', error);
        }
      }

      // 새 로고 업로드
      const logoPath = `brand-assets/${user?.email || 'default'}/logo_${Date.now()}.${file.name.split('.').pop()}`;
      const logoUrl = await uploadFile(file, logoPath);
      
      setLocalSettings(prev => ({ ...prev, brandLogo: logoUrl }));
      
      toast({
        title: '로고 업로드 완료',
        description: '로고가 성공적으로 업로드되었습니다.'
      });
    } catch (error) {
      console.error('로고 업로드 오류:', error);
      toast({
        variant: 'destructive',
        title: '업로드 실패',
        description: '로고 업로드 중 오류가 발생했습니다.'
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  // 파비콘 업로드 처리
  const handleFaviconUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 파일 타입 검증
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '이미지 파일만 업로드할 수 있습니다.'
      });
      return;
    }

    // 파일 크기 검증 (1MB)
    if (file.size > 1 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '파비콘 파일 크기는 1MB 이하여야 합니다.'
      });
      return;
    }

    try {
      setUploadingFavicon(true);
      
      // 기존 파비콘 삭제
      if (localSettings.brandFavicon) {
        try {
          if (localSettings.brandFavicon.includes('firebasestorage')) {
            const oldFaviconRef = ref(storage, localSettings.brandFavicon);
            await deleteObject(oldFaviconRef);
          } else if (localSettings.brandFavicon.includes('googleusercontent.com')) {
            // Google Photos에서 삭제 (mediaItemId 추출 필요)
            const mediaItemId = extractMediaItemId(localSettings.brandFavicon);
            if (mediaItemId) {
              await deleteFromGooglePhotos(mediaItemId);
            }
          }
        } catch (error) {
          console.log('기존 파비콘 삭제 실패 (무시됨):', error);
        }
      }

      // 새 파비콘 업로드
      const faviconPath = `brand-assets/${user?.email || 'default'}/favicon_${Date.now()}.${file.name.split('.').pop()}`;
      const faviconUrl = await uploadFile(file, faviconPath);
      
      setLocalSettings(prev => ({ ...prev, brandFavicon: faviconUrl }));
      
      toast({
        title: '파비콘 업로드 완료',
        description: '파비콘이 성공적으로 업로드되었습니다.'
      });
    } catch (error) {
      console.error('파비콘 업로드 오류:', error);
      toast({
        variant: 'destructive',
        title: '업로드 실패',
        description: '파비콘 업로드 중 오류가 발생했습니다.'
      });
    } finally {
      setUploadingFavicon(false);
    }
  };

  // 로고 삭제
  const handleLogoDelete = async () => {
    if (!localSettings.brandLogo) {
      setLocalSettings(prev => ({ ...prev, brandLogo: '' }));
      return;
    }

    try {
      if (localSettings.brandLogo.includes('firebasestorage')) {
        const logoRef = ref(storage, localSettings.brandLogo);
        await deleteObject(logoRef);
      } else if (localSettings.brandLogo.includes('googleusercontent.com')) {
        const mediaItemId = extractMediaItemId(localSettings.brandLogo);
        if (mediaItemId) {
          await deleteFromGooglePhotos(mediaItemId);
        }
      }
      
      setLocalSettings(prev => ({ ...prev, brandLogo: '' }));
      
      toast({
        title: '로고 삭제 완료',
        description: '로고가 성공적으로 삭제되었습니다.'
      });
    } catch (error) {
      console.error('로고 삭제 오류:', error);
      toast({
        variant: 'destructive',
        title: '삭제 실패',
        description: '로고 삭제 중 오류가 발생했습니다.'
      });
    }
  };

  // 파비콘 삭제
  const handleFaviconDelete = async () => {
    if (!localSettings.brandFavicon) {
      setLocalSettings(prev => ({ ...prev, brandFavicon: '' }));
      return;
    }

    try {
      if (localSettings.brandFavicon.includes('firebasestorage')) {
        const faviconRef = ref(storage, localSettings.brandFavicon);
        await deleteObject(faviconRef);
      } else if (localSettings.brandFavicon.includes('googleusercontent.com')) {
        const mediaItemId = extractMediaItemId(localSettings.brandFavicon);
        if (mediaItemId) {
          await deleteFromGooglePhotos(mediaItemId);
        }
      }
      
      setLocalSettings(prev => ({ ...prev, brandFavicon: '' }));
      
      toast({
        title: '파비콘 삭제 완료',
        description: '파비콘이 성공적으로 삭제되었습니다.'
      });
    } catch (error) {
      console.error('파비콘 삭제 오류:', error);
      toast({
        variant: 'destructive',
        title: '삭제 실패',
        description: '파비콘 삭제 중 오류가 발생했습니다.'
      });
    }
  };
  const handleSpecificDataCleanup = (dataType: string) => {
    setSelectedDataType(dataType);
    setShowConfirmDialog(true);
  };
  const confirmSpecificDataCleanup = () => {
    if (selectedDataType) {
      cleanupSpecificData(selectedDataType);
      setShowConfirmDialog(false);
      setSelectedDataType('');
    }
  };

  // 메뉴 관리 함수들
  const getMenuDisplayName = (menuKey: string): string => {
    const menuNames: { [key: string]: string } = {
      'dashboard': '대시보드',
      'orders/new': '주문접수',
      'orders': '주문현황',
      'products': '상품관리',
      'customers': '고객관리',
      'materials': '자재관리',
      'pickup-delivery': '픽업/배송',
      'recipients': '수령자관리',
      'simple-expenses': '지출관리',
      'partners': '거래처관리',
      'sample-albums': '샘플앨범',
      'reports': '리포트분석',
      'budgets': '예산관리',
      'hr': '인사관리',
      'users': '사용자관리',
      'stock-history': '재고변동기록',
      'settings': '설정'
    };
    return menuNames[menuKey] || menuKey;
  };

  const toggleMenuVisibility = (menuKey: string) => {
    setLocalSettings(prev => ({
      ...prev,
      menuSettings: {
        ...(prev.menuSettings || defaultSettings.menuSettings),
        [menuKey]: {
          ...(prev.menuSettings || defaultSettings.menuSettings)[menuKey],
          visible: !(prev.menuSettings || defaultSettings.menuSettings)[menuKey].visible
        }
      }
    }));
  };

  const moveMenuUp = (menuKey: string) => {
    console.log('moveMenuUp called with:', menuKey);
    setLocalSettings(prev => {
      const menuSettings = prev.menuSettings || defaultSettings.menuSettings;
      const currentOrder = menuSettings[menuKey]?.order;
      console.log('Current order:', currentOrder);
      if (!currentOrder || currentOrder <= 1) return prev;

      const newMenuSettings = { ...menuSettings };
      
      // 현재 메뉴와 위 메뉴의 순서를 바꿈
      Object.keys(newMenuSettings).forEach(key => {
        if (newMenuSettings[key].order === currentOrder - 1) {
          newMenuSettings[key].order = currentOrder;
          console.log(`Moved ${key} from ${currentOrder - 1} to ${currentOrder}`);
        } else if (key === menuKey) {
          newMenuSettings[key].order = currentOrder - 1;
          console.log(`Moved ${key} from ${currentOrder} to ${currentOrder - 1}`);
        }
      });

      console.log('New menu settings:', newMenuSettings);
      return {
        ...prev,
        menuSettings: newMenuSettings
      };
    });
  };

  const moveMenuDown = (menuKey: string) => {
    console.log('moveMenuDown called with:', menuKey);
    setLocalSettings(prev => {
      const menuSettings = prev.menuSettings || defaultSettings.menuSettings;
      const currentOrder = menuSettings[menuKey]?.order;
      const maxOrder = Object.keys(menuSettings).length;
      console.log('Current order:', currentOrder, 'Max order:', maxOrder);
      if (!currentOrder || currentOrder >= maxOrder) return prev;

      const newMenuSettings = { ...menuSettings };
      
      // 현재 메뉴와 아래 메뉴의 순서를 바꿈
      Object.keys(newMenuSettings).forEach(key => {
        if (newMenuSettings[key].order === currentOrder + 1) {
          newMenuSettings[key].order = currentOrder;
          console.log(`Moved ${key} from ${currentOrder + 1} to ${currentOrder}`);
        } else if (key === menuKey) {
          newMenuSettings[key].order = currentOrder + 1;
          console.log(`Moved ${key} from ${currentOrder} to ${currentOrder + 1}`);
        }
      });

      console.log('New menu settings:', newMenuSettings);
      return {
        ...prev,
        menuSettings: newMenuSettings
      };
    });
  };

  const resetMenuSettings = () => {
    setLocalSettings(prev => ({
      ...prev,
      menuSettings: defaultSettings.menuSettings
    }));
  };

  // 사용자 관리 메뉴 추가 기능은 더 이상 필요하지 않음
  // const [showUsersMenuToast, setShowUsersMenuToast] = useState(false);
  // const [usersMenuToastMessage, setUsersMenuToastMessage] = useState('');

  // const addUsersMenu = () => {
  //   const currentMenuSettings = localSettings.menuSettings || defaultSettings.menuSettings;
    
  //   // users 메뉴가 이미 있으면 아무것도 하지 않음
  //   if (currentMenuSettings.users) {
  //     setUsersMenuToastMessage("사용자관리 메뉴가 이미 존재합니다.");
  //     setShowUsersMenuToast(true);
  //     return;
  //   }

  //   setLocalSettings(prev => {
  //     // users 메뉴 추가
  //     const newMenuSettings = {
  //       ...currentMenuSettings,
  //       "users": { visible: true, order: 15, label: "사용자관리" }
  //     };

  //     // 기존 메뉴들의 순서 조정
  //     if (newMenuSettings["stock-history"]) {
  //       newMenuSettings["stock-history"].order = 16;
  //     }
  //     if (newMenuSettings["settings"]) {
  //       newMenuSettings["settings"].order = 17;
  //     }

  //     return {
  //       ...prev,
  //       menuSettings: newMenuSettings
  //     };
  //   });

  //   setUsersMenuToastMessage("사용자관리 메뉴가 추가되었습니다.");
  //   setShowUsersMenuToast(true);
  // };

  const saveMenuSettings = async () => {
    try {
      setSaving(true);
      const success = await saveSettings(localSettings);
      if (success) {
        toast({
          title: '메뉴 설정 저장 완료',
          description: '메뉴 설정이 성공적으로 저장되었습니다.'
        });
      } else {
        toast({
          variant: 'destructive',
          title: '저장 실패',
          description: '메뉴 설정 저장 중 오류가 발생했습니다.'
        });
      }
    } catch (error) {
      console.error('메뉴 설정 저장 오류:', error);
      toast({
        variant: 'destructive',
        title: '저장 실패',
        description: '메뉴 설정 저장 중 오류가 발생했습니다.'
      });
    } finally {
      setSaving(false);
    }
  };

  const getDataTypeName = (dataType: string): string => {
    const dataTypeNames: { [key: string]: string } = {
      'orders': '주문',
      'customers': '고객',
      'products': '상품',
      'materials': '자재',
      'expenses': '간편지출',
      'materialRequests': '자재요청',
             'employees': '직원',
       'partners': '거래처',
       'stockHistory': '재고이력',
      'albums': '샘플앨범'
    };
    return dataTypeNames[dataType] || dataType;
  };
  // settings가 로드되었을 때만 localSettings 업데이트
  useEffect(() => {
    if (!loading && settings !== defaultSettings) {
      // 메뉴 설정이 없으면 기본값으로 설정
      const updatedSettings = {
        ...settings,
        menuSettings: settings.menuSettings || defaultSettings.menuSettings
      };
      setLocalSettings(updatedSettings);

       // 저장된 폰트들을 로드
       const savedFonts = localStorage.getItem('customFonts');
       if (savedFonts) {
         try {
           const fonts = JSON.parse(savedFonts);
           // 폰트가 설정에 없으면 추가
           if (fonts.length > 0 && (!updatedSettings.availableFonts || updatedSettings.availableFonts.length === 0)) {
             setLocalSettings(prev => ({
               ...prev,
               availableFonts: fonts
             }));
           }
         } catch (error) {
           console.error('저장된 폰트 로드 오류:', error);
         }
       }
    }
  }, [settings, loading]);

  // 사용자 메뉴 추가 toast 처리 - 더 이상 필요하지 않음
  // useEffect(() => {
  //   if (showUsersMenuToast && usersMenuToastMessage) {
  //     toast({
  //       title: usersMenuToastMessage.includes("이미 존재") ? "알림" : "성공",
  //       description: usersMenuToastMessage,
  //     });
  //     setShowUsersMenuToast(false);
  //     setUsersMenuToastMessage('');
  //   }
  // }, [showUsersMenuToast, usersMenuToastMessage, toast]);
  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const success = await saveSettings(localSettings);
      if (success) {
        // 브랜드 설정이 변경된 경우 파비콘 업데이트
        if (localSettings.brandFavicon && localSettings.brandFavicon !== settings?.brandFavicon) {
          const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
          if (link) {
            link.href = localSettings.brandFavicon;
          }
        }
        
        // 사이트명이 변경된 경우 페이지 제목 업데이트
        if (localSettings.siteName !== settings?.siteName) {
          const newTitle = localSettings.siteName || 'Flower Shop ERP';
          document.title = newTitle;
          console.log('브라우저 탭 제목 업데이트:', {
            oldSiteName: settings?.siteName,
            newSiteName: localSettings.siteName,
            newTitle: newTitle
          });
        }

         // 폰트 설정이 변경된 경우 로컬 스토리지에 저장
         if (localSettings.availableFonts !== settings?.availableFonts) {
           localStorage.setItem('customFonts', JSON.stringify(localSettings.availableFonts || []));
        }
        
        toast({
          title: '설정 저장 완료',
          description: '브랜드 정보를 포함한 모든 시스템 설정이 저장되었습니다.'
        });
      } else {
        toast({
          variant: 'destructive',
          title: '오류',
          description: '설정 저장 중 오류가 발생했습니다.'
        });
      }
    } catch (error) {
      console.error('설정 저장 중 오류:', error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '설정 저장 중 오류가 발생했습니다.'
      });
    } finally {
      setSaving(false);
    }
  };
  const resetToDefaults = () => {
    setLocalSettings(settings);
    toast({
      title: '초기화 완료',
      description: '설정이 기본값으로 초기화되었습니다.'
    });
  };
  const addNewFont = () => {
    if (!newFont.trim()) return;
    const fontName = newFont.trim();
    const currentFonts = localSettings.availableFonts || [];
    if (currentFonts.includes(fontName)) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '이미 존재하는 폰트입니다.'
      });
      return;
    }
    setLocalSettings(prev => ({
      ...prev,
      availableFonts: [...currentFonts, fontName]
    }));
    setNewFont('');
    toast({
      title: '성공',
      description: `폰트 "${fontName}"가 추가되었습니다.`
    });
  };

  // 온라인 폰트 추가 함수
  const addOnlineFont = (fontFamily: string, fontUrl?: string) => {
    const currentFonts = localSettings.availableFonts || [];
    if (currentFonts.includes(fontFamily)) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '이미 존재하는 폰트입니다.'
      });
      return;
    }

    // 폰트 URL이 있으면 동적으로 CSS 추가
    if (fontUrl) {
      const link = document.createElement('link');
      link.href = fontUrl;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }

    setLocalSettings(prev => ({
      ...prev,
      availableFonts: [...currentFonts, fontFamily]
    }));

    toast({
      title: '성공',
      description: `온라인 폰트 "${fontFamily}"가 추가되었습니다.`
    });
  };
  // 본사 관리자가 아니면 접근 제한
  if (!isHQManager()) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">접근 권한이 없습니다</h2>
          <p className="text-gray-500">시스템 설정은 본사 관리자만 접근할 수 있습니다.</p>
        </div>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>설정을 불러오는 중...</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="시스템 설정"
        description="시스템의 기본 설정을 관리합니다."
      />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-12">
          <TabsTrigger value="brand">브랜드관리</TabsTrigger>
          <TabsTrigger value="menu">메뉴관리</TabsTrigger>
          <TabsTrigger value="general">일반 설정</TabsTrigger>
          <TabsTrigger value="delivery">배송 설정</TabsTrigger>
          <TabsTrigger value="notifications">알림 설정</TabsTrigger>
          <TabsTrigger value="messages">메시지 설정</TabsTrigger>
          <TabsTrigger value="auto-email">자동 이메일</TabsTrigger>
          <TabsTrigger value="photos">사진관리</TabsTrigger>
          <TabsTrigger value="security">보안 설정</TabsTrigger>
          <TabsTrigger value="discount">할인 설정</TabsTrigger>
          <TabsTrigger value="backup">백업 관리</TabsTrigger>
          <TabsTrigger value="data-cleanup">데이터 초기화</TabsTrigger>
        </TabsList>
        {/* 브랜드 관리 */}
        <TabsContent value="brand" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                브랜드 정보
              </CardTitle>
              <CardDescription>
                플라워샵의 브랜드 정보를 관리합니다. 로고, 파비콘, 연락처 정보 등을 설정할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                             {/* 로고 및 파비콘 */}
               <div className="space-y-4">
                 <h3 className="text-lg font-semibold">로고 및 아이콘</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                     <Label>브랜드 로고</Label>
                     <div className="space-y-2">
                       <div className="flex gap-2">
                         <input
                           type="file"
                           id="logoUpload"
                           accept="image/*"
                           onChange={handleLogoUpload}
                           className="hidden"
                           disabled={uploadingLogo}
                         />
                         <label
                           htmlFor="logoUpload"
                           className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                           <Upload className="h-4 w-4" />
                           {uploadingLogo ? '업로드 중...' : '로고 업로드'}
                         </label>
                         {localSettings.brandLogo && (
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={handleLogoDelete}
                             disabled={uploadingLogo}
                             className="text-red-600 hover:text-red-700"
                           >
                             <X className="h-4 w-4" />
                           </Button>
                         )}
                       </div>
                       {localSettings.brandLogo && (
                         <div className="mt-2">
                           <Label>로고 미리보기</Label>
                           <div className="mt-1 p-2 border rounded">
                             <img 
                               src={localSettings.brandLogo} 
                               alt="브랜드 로고" 
                               className="max-h-20 max-w-full object-contain"
                               onError={(e) => {
                                 e.currentTarget.style.display = 'none';
                               }}
                             />
                           </div>
                         </div>
                       )}
                       <p className="text-xs text-gray-500">
                         • 이미지 파일만 업로드 가능 (JPG, PNG, GIF 등)
                         • 파일 크기: 최대 5MB
                         • 권장 크기: 200x80px 이상
                       </p>
                     </div>
                   </div>
                   <div className="space-y-2">
                     <Label>파비콘</Label>
                     <div className="space-y-2">
                       <div className="flex gap-2">
                         <input
                           type="file"
                           id="faviconUpload"
                           accept="image/*"
                           onChange={handleFaviconUpload}
                           className="hidden"
                           disabled={uploadingFavicon}
                         />
                         <label
                           htmlFor="faviconUpload"
                           className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                           <Upload className="h-4 w-4" />
                           {uploadingFavicon ? '업로드 중...' : '파비콘 업로드'}
                         </label>
                         {localSettings.brandFavicon && (
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={handleFaviconDelete}
                             disabled={uploadingFavicon}
                             className="text-red-600 hover:text-red-700"
                           >
                             <X className="h-4 w-4" />
                           </Button>
                         )}
                       </div>
                       {localSettings.brandFavicon && (
                         <div className="mt-2">
                           <Label>파비콘 미리보기</Label>
                           <div className="mt-1 p-2 border rounded">
                             <img 
                               src={localSettings.brandFavicon} 
                               alt="파비콘" 
                               className="h-8 w-8 object-contain"
                               onError={(e) => {
                                 e.currentTarget.style.display = 'none';
                               }}
                             />
                           </div>
                         </div>
                       )}
                       <p className="text-xs text-gray-500">
                         • 이미지 파일만 업로드 가능 (ICO, PNG 등)
                         • 파일 크기: 최대 1MB
                         • 권장 크기: 32x32px 또는 16x16px
                       </p>
                     </div>
                   </div>
                 </div>
               </div>

              {/* 기본 정보 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">기본 정보</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="brandName">플라워샵 이름</Label>
                    <Input
                      id="brandName"
                      value={localSettings.brandName}
                      onChange={(e) => setLocalSettings(prev => ({ ...prev, brandName: e.target.value }))}
                      placeholder="플라워샵"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brandContactPhone">연락처</Label>
                    <Input
                      id="brandContactPhone"
                      value={localSettings.brandContactPhone}
                      onChange={(e) => setLocalSettings(prev => ({ ...prev, brandContactPhone: e.target.value }))}
                      placeholder="02-1234-5678"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="brandAddress">주소</Label>
                    <Input
                      id="brandAddress"
                      value={localSettings.brandAddress}
                      onChange={(e) => setLocalSettings(prev => ({ ...prev, brandAddress: e.target.value }))}
                      placeholder="서울특별시 종로구 광화문로 123"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="businessNumber">사업자번호</Label>
                    <Input
                      id="businessNumber"
                      value={localSettings.businessNumber}
                      onChange={(e) => setLocalSettings(prev => ({ ...prev, businessNumber: e.target.value }))}
                      placeholder="123-45-67890"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="businessOwner">대표자명</Label>
                    <Input
                      id="businessOwner"
                      value={localSettings.businessOwner}
                      onChange={(e) => setLocalSettings(prev => ({ ...prev, businessOwner: e.target.value }))}
                      placeholder="홍길동"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="onlineShoppingMall">온라인쇼핑몰</Label>
                    <Input
                      id="onlineShoppingMall"
                      value={localSettings.onlineShoppingMall}
                      onChange={(e) => setLocalSettings(prev => ({ ...prev, onlineShoppingMall: e.target.value }))}
                      placeholder="https://www.lilymag.com"
                    />
                    <p className="text-xs text-gray-500">
                      온라인쇼핑몰 주소를 입력하세요. 인수증 하단에 표시됩니다.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 메뉴 관리 */}
        <TabsContent value="menu" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Menu className="h-5 w-5" />
                메뉴 관리
              </CardTitle>
              <CardDescription>
                사이드바 메뉴의 표시 여부와 순서를 관리합니다. 원하는 메뉴만 보이게 하거나 순서를 변경할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">메뉴 설정</h3>
                <div className="space-y-3">
                  {Object.entries(localSettings.menuSettings || defaultSettings.menuSettings)
                    .sort(([,a], [,b]) => a.order - b.order)
                    .map(([menuKey, menuConfig]) => (
                    <div
                      key={menuKey}
                      className={`flex items-center justify-between p-3 border rounded-lg transition-all duration-200 ${
                        draggedItem === menuKey 
                          ? 'bg-blue-100 border-blue-300 shadow-lg opacity-50' 
                          : dragOverItem === menuKey
                          ? 'bg-green-100 border-green-300 shadow-md'
                          : 'bg-gray-50 hover:bg-gray-100'
                      } ${draggedItem && draggedItem !== menuKey ? 'cursor-pointer' : 'cursor-grab'}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, menuKey)}
                      onDragOver={(e) => handleDragOver(e, menuKey)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, menuKey)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                        <span className="font-medium">{getMenuDisplayName(menuKey)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleMenuVisibility(menuKey)}
                          className={menuConfig.visible ? "text-green-600" : "text-gray-400"}
                        >
                          {menuConfig.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          {menuConfig.visible ? "보임" : "숨김"}
                        </Button>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              console.log('Up button clicked for:', menuKey);
                              moveMenuUp(menuKey);
                            }}
                            disabled={menuConfig.order <= 1}
                          >
                            ↑
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              console.log('Down button clicked for:', menuKey);
                              moveMenuDown(menuKey);
                            }}
                            disabled={menuConfig.order >= Object.keys(localSettings.menuSettings || defaultSettings.menuSettings).length}
                          >
                            ↓
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={resetMenuSettings} variant="outline">
                  기본값으로 복원
                </Button>
                <Button onClick={saveMenuSettings}>
                  메뉴 설정 저장
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 일반 설정 */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                사이트 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="siteName">사이트명</Label>
                  <Input
                    id="siteName"
                    value={localSettings.siteName}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, siteName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siteDescription">사이트 설명</Label>
                  <Input
                    id="siteDescription"
                    value={localSettings.siteDescription}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, siteDescription: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">연락처 이메일</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={localSettings.contactEmail}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, contactEmail: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">연락처 전화번호</Label>
                  <Input
                    id="contactPhone"
                    value={localSettings.contactPhone}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, contactPhone: e.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                시스템 설정
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="orderNumberPrefix">주문번호 접두사</Label>
                  <Input
                    id="orderNumberPrefix"
                    value={localSettings.orderNumberPrefix}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, orderNumberPrefix: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pointEarnRate">포인트 적립률 (%)</Label>
                  <Input
                    id="pointEarnRate"
                    type="number"
                    min="0"
                    max="10"
                    value={localSettings.pointEarnRate}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, pointEarnRate: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dataRetentionDays">데이터 보관 기간 (일)</Label>
                  <Input
                    id="dataRetentionDays"
                    type="number"
                    min="30"
                    max="1095"
                    value={localSettings.dataRetentionDays}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, dataRetentionDays: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 알림 설정 */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                알림 설정
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>이메일 알림</Label>
                    <p className="text-sm text-gray-500">주문 및 시스템 알림을 이메일로 받습니다</p>
                  </div>
                                     <input
                     type="checkbox"
                     checked={localSettings.emailNotifications}
                     onChange={(e) => setLocalSettings(prev => ({ ...prev, emailNotifications: e.target.checked }))}
                     className="h-4 w-4"
                   />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>SMS 알림</Label>
                    <p className="text-sm text-gray-500">중요한 알림을 SMS로 받습니다</p>
                  </div>
                                     <input
                     type="checkbox"
                     checked={localSettings.smsNotifications}
                     onChange={(e) => setLocalSettings(prev => ({ ...prev, smsNotifications: e.target.checked }))}
                     className="h-4 w-4"
                   />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>자동 백업</Label>
                    <p className="text-sm text-gray-500">정기적으로 데이터를 자동 백업합니다</p>
                  </div>
                                     <input
                     type="checkbox"
                     checked={localSettings.autoBackup}
                     onChange={(e) => setLocalSettings(prev => ({ ...prev, autoBackup: e.target.checked }))}
                     className="h-4 w-4"
                   />
                </div>
              </div>
            </CardContent>
          </Card>
                 </TabsContent>
         {/* 메시지 설정 */}
         <TabsContent value="messages" className="space-y-4">
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <MessageSquare className="h-5 w-5" />
                 메시지 출력 설정
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                   <div className="space-y-2">
                    <Label htmlFor="messageFont">메시지 폰트</Label>
                    <select
                      id="messageFont"
                      value={localSettings.messageFont}
                      onChange={(e) => setLocalSettings(prev => ({ ...prev, messageFont: e.target.value }))}
                      className="w-full p-2 border rounded-md"
                    >
                      {localSettings.availableFonts?.map((font) => (
                        <option key={font} value={font} style={{ fontFamily: font }}>
                          {font}
                        </option>
                      ))}
                    </select>
                  </div>
                 <div className="space-y-2">
                   <Label htmlFor="messageFontSize">폰트 크기 (px)</Label>
                   <Input
                     id="messageFontSize"
                     type="number"
                     min="10"
                     max="24"
                     value={localSettings.messageFontSize}
                     onChange={(e) => setLocalSettings(prev => ({ ...prev, messageFontSize: Number(e.target.value) }))}
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="messageColor">메시지 색상</Label>
                   <Input
                     id="messageColor"
                     type="color"
                     value={localSettings.messageColor}
                     onChange={(e) => setLocalSettings(prev => ({ ...prev, messageColor: e.target.value }))}
                     className="w-full h-10"
                   />
                 </div>
               </div>
               <div className="space-y-2">
                 <Label htmlFor="messageTemplate">기본 메시지 템플릿</Label>
                 <textarea
                   id="messageTemplate"
                   value={localSettings.messageTemplate}
                   onChange={(e) => setLocalSettings(prev => ({ ...prev, messageTemplate: e.target.value }))}
                   className="w-full p-2 border rounded-md h-24"
                   placeholder="메시지 템플릿을 입력하세요. {고객명}, {상태} 등의 변수를 사용할 수 있습니다."
                 />
                                   <p className="text-xs text-gray-500">
                    사용 가능한 변수: {'{고객명}'}, {'{상태}'}, {'{주문번호}'}, {'{총금액}'}
                  </p>
                </div>
              </CardContent>
            </Card>
            {/* 폰트 관리 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Type className="h-5 w-5" />
                  폰트 관리
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>사용 가능한 폰트 목록</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-2">
                    {localSettings.availableFonts?.map((font, index) => (
                      <div key={font} className="flex items-center justify-between p-2 border rounded">
                         <div className="flex flex-col">
                           <span style={{ fontFamily: font }} className="text-sm font-medium">
                          {font}
                        </span>
                           <span style={{ fontFamily: font }} className="text-xs text-gray-500">
                             The quick brown fox jumps over the lazy dog
                             <br />
                             안녕하세요 반갑습니다
                           </span>
                         </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newFonts = localSettings.availableFonts?.filter((_, i) => i !== index) || [];
                            setLocalSettings(prev => ({ ...prev, availableFonts: newFonts }));
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          삭제
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                                 <div className="space-y-4">
                <div className="space-y-2">
                     <Label htmlFor="newFont">로컬 폰트 추가</Label>
                  <div className="flex gap-2">
                    <Input
                      id="newFont"
                      placeholder="폰트 이름을 입력하세요 (예: Roboto)"
                      value={newFont}
                      onChange={(e) => setNewFont(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={addNewFont}
                      disabled={!newFont.trim()}
                      size="sm"
                    >
                      추가
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    • 폰트 이름은 정확히 입력해야 합니다 (예: "Roboto", "Open Sans")
                    • 시스템에 설치된 폰트만 사용 가능합니다
                     </p>
                   </div>

                   <div className="space-y-2">
                     <Label>온라인 폰트 추가</Label>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => addOnlineFont('Roboto', 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap')}
                       >
                         Roboto 추가
                       </Button>
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => addOnlineFont('Open Sans', 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&display=swap')}
                       >
                         Open Sans 추가
                       </Button>
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => addOnlineFont('Lato', 'https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap')}
                       >
                         Lato 추가
                       </Button>
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => addOnlineFont('Poppins', 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap')}
                       >
                         Poppins 추가
                       </Button>
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => addOnlineFont('Inter', 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap')}
                       >
                         Inter 추가
                       </Button>
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => addOnlineFont('Noto Sans KR', 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap')}
                       >
                         Noto Sans KR 추가
                       </Button>
                     </div>
                     <p className="text-xs text-gray-500">
                       • Google Fonts에서 인기 있는 폰트들을 한 번에 추가할 수 있습니다
                       • 한국어 지원 폰트도 포함되어 있습니다
                     </p>
                   </div>

                   <div className="space-y-2">
                     <Label>커스텀 온라인 폰트</Label>
                     <div className="flex gap-2">
                       <Input
                         placeholder="폰트 이름 (예: My Custom Font)"
                         value={newFont}
                         onChange={(e) => setNewFont(e.target.value)}
                         className="flex-1"
                       />
                       <Input
                         placeholder="CSS URL (예: https://fonts.googleapis.com/css2?family=...)"
                         className="flex-1"
                         id="customFontUrl"
                       />
                       <Button
                         onClick={() => {
                           const fontUrl = (document.getElementById('customFontUrl') as HTMLInputElement)?.value;
                           if (newFont.trim() && fontUrl) {
                             addOnlineFont(newFont.trim(), fontUrl);
                             setNewFont('');
                             (document.getElementById('customFontUrl') as HTMLInputElement).value = '';
                           } else {
                             toast({
                               variant: 'destructive',
                               title: '오류',
                               description: '폰트 이름과 CSS URL을 모두 입력해주세요.'
                             });
                           }
                         }}
                         disabled={!newFont.trim()}
                         size="sm"
                       >
                         추가
                       </Button>
                     </div>
                     <p className="text-xs text-gray-500">
                       • Google Fonts, Adobe Fonts, 또는 다른 웹 폰트 서비스의 CSS URL을 입력하세요
                       • 예: https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap
                     </p>
                   </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          {/* 백업 관리 */}
          <TabsContent value="backup" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  백업 관리
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <BackupManagement />
              </CardContent>
            </Card>
          </TabsContent>
         {/* 자동 이메일 설정 */}
         <TabsContent value="auto-email" className="space-y-4">
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <Mail className="h-5 w-5" />
                 자동 이메일 설정
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="space-y-4">
                 <div className="flex items-center justify-between">
                   <div>
                     <Label>배송완료 자동 이메일</Label>
                     <p className="text-sm text-gray-500">배송 완료 시 고객에게 자동으로 이메일을 발송합니다</p>
                   </div>
                   <input
                     type="checkbox"
                     checked={localSettings.autoEmailDeliveryComplete}
                     onChange={(e) => setLocalSettings(prev => ({ ...prev, autoEmailDeliveryComplete: e.target.checked }))}
                     className="h-4 w-4"
                   />
                 </div>
                 <div className="flex items-center justify-between">
                   <div>
                     <Label>주문확인 자동 이메일</Label>
                     <p className="text-sm text-gray-500">주문 접수 시 고객에게 확인 이메일을 발송합니다</p>
                   </div>
                   <input
                     type="checkbox"
                     checked={localSettings.autoEmailOrderConfirm}
                     onChange={(e) => setLocalSettings(prev => ({ ...prev, autoEmailOrderConfirm: e.target.checked }))}
                     className="h-4 w-4"
                   />
                 </div>
                 <div className="flex items-center justify-between">
                   <div>
                     <Label>상태변경 자동 이메일</Label>
                     <p className="text-sm text-gray-500">주문 상태 변경 시 고객에게 알림 이메일을 발송합니다</p>
                   </div>
                   <input
                     type="checkbox"
                     checked={localSettings.autoEmailStatusChange}
                     onChange={(e) => setLocalSettings(prev => ({ ...prev, autoEmailStatusChange: e.target.checked }))}
                     className="h-4 w-4"
                   />
                 </div>
                 <div className="flex items-center justify-between">
                   <div>
                     <Label>생일 축하 자동 이메일</Label>
                     <p className="text-sm text-gray-500">고객 생일 시 축하 이메일을 자동으로 발송합니다</p>
                   </div>
                   <input
                     type="checkbox"
                     checked={localSettings.autoEmailBirthday}
                     onChange={(e) => setLocalSettings(prev => ({ ...prev, autoEmailBirthday: e.target.checked }))}
                     className="h-4 w-4"
                   />
                 </div>
               </div>
                             <div className="space-y-6 mt-6">
                <h4 className="font-medium">이메일 템플릿</h4>
                
                <EmailTemplateEditor
                  templateName="주문확인"
                  value={localSettings.emailTemplateOrderConfirm}
                  onChange={(value) => setLocalSettings(prev => ({ ...prev, emailTemplateOrderConfirm: value }))}
                  variables={['고객명', '주문번호', '주문일', '총금액', '회사명', '연락처', '이메일']}
                />
                
                <EmailTemplateEditor
                  templateName="배송완료"
                  value={localSettings.emailTemplateDeliveryComplete}
                  onChange={(value) => setLocalSettings(prev => ({ ...prev, emailTemplateDeliveryComplete: value }))}
                  variables={['고객명', '주문번호', '배송일', '회사명', '연락처', '이메일']}
                />
                
                <EmailTemplateEditor
                  templateName="상태변경"
                  value={localSettings.emailTemplateStatusChange}
                  onChange={(value) => setLocalSettings(prev => ({ ...prev, emailTemplateStatusChange: value }))}
                  variables={['고객명', '주문번호', '이전상태', '현재상태', '회사명', '연락처', '이메일']}
                />
                
                <EmailTemplateEditor
                  templateName="생일축하"
                  value={localSettings.emailTemplateBirthday}
                  onChange={(value) => setLocalSettings(prev => ({ ...prev, emailTemplateBirthday: value }))}
                  variables={['고객명', '회사명', '연락처', '이메일']}
                />
              </div>
             </CardContent>
           </Card>
         </TabsContent>

         {/* 사진관리 설정 탭 */}
         <TabsContent value="photos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                배송완료 사진 관리
              </CardTitle>
              <CardDescription>
                배송완료 사진의 자동 삭제 및 보관 정책을 설정합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>자동 삭제 활성화</Label>
                  <p className="text-sm text-gray-500">설정된 기간이 지난 배송완료 사진을 자동으로 삭제합니다</p>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.autoDeleteDeliveryPhotos}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, autoDeleteDeliveryPhotos: e.target.checked }))}
                  className="h-4 w-4"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryPhotoRetentionDays">보관 기간 (일)</Label>
                <Input
                  id="deliveryPhotoRetentionDays"
                  type="number"
                  min="1"
                  max="365"
                  value={localSettings.deliveryPhotoRetentionDays}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, deliveryPhotoRetentionDays: Number(e.target.value) }))}
                  disabled={!localSettings.autoDeleteDeliveryPhotos}
                />
                <p className="text-xs text-gray-500">
                  {localSettings.autoDeleteDeliveryPhotos 
                    ? `${localSettings.deliveryPhotoRetentionDays}일 후 자동으로 삭제됩니다.`
                    : '자동 삭제가 비활성화되어 있습니다.'
                  }
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                이메일 사진 첨부 관리
              </CardTitle>
              <CardDescription>
                자동 이메일 발송 시 첨부할 사진을 관리합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>이메일 사진 첨부 활성화</Label>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="emailPhotoAttachment"
                    checked={localSettings.emailPhotoAttachment || false}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, emailPhotoAttachment: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="emailPhotoAttachment" className="text-sm">
                    자동 이메일 발송 시 사진 첨부
                  </Label>
                </div>
                <p className="text-xs text-gray-500">
                  주문 완료, 배송 완료 등의 자동 이메일 발송 시 관련 사진을 첨부합니다.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>첨부 사진 종류</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="attachOrderPhotos"
                      checked={localSettings.attachOrderPhotos || false}
                      onChange={(e) => setLocalSettings(prev => ({ ...prev, attachOrderPhotos: e.target.checked }))}
                      className="h-4 w-4"
                      disabled={!localSettings.emailPhotoAttachment}
                    />
                    <Label htmlFor="attachOrderPhotos" className="text-sm">
                      주문 상품 사진
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="attachDeliveryPhotos"
                      checked={localSettings.attachDeliveryPhotos || false}
                      onChange={(e) => setLocalSettings(prev => ({ ...prev, attachDeliveryPhotos: e.target.checked }))}
                      className="h-4 w-4"
                      disabled={!localSettings.emailPhotoAttachment}
                    />
                    <Label htmlFor="attachDeliveryPhotos" className="text-sm">
                      배송 완료 사진
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="attachBrandLogo"
                      checked={localSettings.attachBrandLogo || false}
                      onChange={(e) => setLocalSettings(prev => ({ ...prev, attachBrandLogo: e.target.checked }))}
                      className="h-4 w-4"
                      disabled={!localSettings.emailPhotoAttachment}
                    />
                    <Label htmlFor="attachBrandLogo" className="text-sm">
                      브랜드 로고
                    </Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxPhotoSize">최대 사진 크기 (MB)</Label>
                <Input
                  id="maxPhotoSize"
                  type="number"
                  min="1"
                  max="10"
                  value={localSettings.maxPhotoSize || 5}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, maxPhotoSize: Number(e.target.value) }))}
                  disabled={!localSettings.emailPhotoAttachment}
                />
                <p className="text-xs text-gray-500">
                  이메일 첨부 사진의 최대 크기를 설정합니다. (1-10MB)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                사진 정리 도구
              </CardTitle>
              <CardDescription>
                불필요한 사진들을 정리하고 저장 공간을 관리합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>오래된 배송완료 사진 정리</Label>
                  <p className="text-sm text-gray-500">설정된 기간이 지난 배송완료 사진을 수동으로 정리합니다.</p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      toast({
                        title: '정리 완료',
                        description: '오래된 배송완료 사진이 정리되었습니다.'
                      });
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    정리 실행
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>중복 사진 검사</Label>
                  <p className="text-sm text-gray-500">중복된 사진들을 찾아서 정리합니다.</p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      toast({
                        title: '검사 완료',
                        description: '중복 사진 검사가 완료되었습니다.'
                      });
                    }}
                  >
                    <Search className="h-4 w-4 mr-2" />
                    검사 실행
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
         </TabsContent>
         {/* 보안 설정 */}
         <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                보안 설정
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">세션 타임아웃 (분)</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    min="5"
                    max="480"
                    value={localSettings.sessionTimeout}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, sessionTimeout: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passwordMinLength">최소 비밀번호 길이</Label>
                  <Input
                    id="passwordMinLength"
                    type="number"
                    min="6"
                    max="20"
                    value={localSettings.passwordMinLength}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, passwordMinLength: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>비밀번호 변경 요구</Label>
                  <p className="text-sm text-gray-500">정기적으로 비밀번호 변경을 요구합니다</p>
                </div>
                                 <input
                   type="checkbox"
                   checked={localSettings.requirePasswordChange}
                   onChange={(e) => setLocalSettings(prev => ({ ...prev, requirePasswordChange: e.target.checked }))}
                   className="h-4 w-4"
                 />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
         {/* 할인 설정 */}
         <TabsContent value="discount" className="space-y-4">
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <Percent className="h-5 w-5" />
                 할인 설정
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="text-center py-8">
                 <Percent className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                 <h3 className="text-lg font-semibold mb-2">할인 설정 관리</h3>
                 <p className="text-gray-500 mb-6">
                   지점별 할인율, 할인 기간, 할인 조건 등을 관리할 수 있습니다.
                 </p>
                 <Button 
                   onClick={() => window.location.href = '/dashboard/settings/discount'}
                   className="bg-blue-600 hover:bg-blue-700"
                 >
                   <Percent className="h-4 w-4 mr-2" />
                   할인 설정 관리
                 </Button>
               </div>
             </CardContent>
           </Card>
         </TabsContent>
         {/* 데이터 초기화 */}
         <TabsContent value="data-cleanup" className="space-y-4">
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <Trash2 className="h-5 w-5" />
                 데이터 초기화
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                 <div className="flex items-start gap-3">
                   <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                   <div>
                     <h4 className="font-medium text-yellow-800 mb-2">⚠️ 주의사항</h4>
                     <ul className="text-sm text-yellow-700 space-y-1">
                       <li>• 삭제된 데이터는 복구할 수 없습니다.</li>
                       <li>• 실제 운영 환경에서는 신중하게 사용하세요.</li>
                       <li>• 테스트 데이터 정리 시에만 사용하세요.</li>
                       <li>• 삭제 전 반드시 백업을 확인하세요.</li>
                     </ul>
                   </div>
                 </div>
               </div>
               {/* 전체 데이터 초기화 */}
               <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                 <h4 className="font-medium text-red-800 mb-3">전체 데이터 초기화</h4>
                 <p className="text-sm text-red-700 mb-4">
                   모든 테스트 데이터를 한 번에 삭제합니다. (주문, 고객, 상품, 자재, 지출 등)
                 </p>
                 <AlertDialog>
                   <AlertDialogTrigger asChild>
                     <Button 
                       disabled={cleanupLoading}
                       variant="destructive"
                       className="w-full"
                     >
                       <Trash2 className="h-4 w-4 mr-2" />
                       {cleanupLoading ? '전체 데이터 삭제 중...' : '전체 데이터 삭제'}
                     </Button>
                   </AlertDialogTrigger>
                   <AlertDialogContent>
                     <AlertDialogHeader>
                       <AlertDialogTitle>⚠️ 전체 데이터 삭제</AlertDialogTitle>
                       <AlertDialogDescription>
                         정말로 모든 테스트 데이터를 삭제하시겠습니까?<br />
                         <strong>이 작업은 되돌릴 수 없습니다.</strong><br /><br />
                         삭제될 데이터:
                         <ul className="list-disc list-inside mt-2 space-y-1">
                           <li>주문 데이터</li>
                           <li>고객 데이터</li>
                           <li>상품 데이터</li>
                           <li>자재 데이터</li>
                           <li>간편지출 데이터</li>
                           <li>자재요청 데이터</li>
                                                       <li>직원 데이터</li>
                            <li>거래처 데이터</li>
                            <li>재고이력 데이터</li>
                           <li>샘플앨범 데이터</li>
                         </ul>
                       </AlertDialogDescription>
                     </AlertDialogHeader>
                     <AlertDialogFooter>
                       <AlertDialogCancel>취소</AlertDialogCancel>
                       <AlertDialogAction
                         onClick={cleanupAllData}
                         className="bg-red-600 hover:bg-red-700"
                       >
                         삭제 확인
                       </AlertDialogAction>
                     </AlertDialogFooter>
                   </AlertDialogContent>
                 </AlertDialog>
               </div>
               {/* 개별 데이터 초기화 */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="border rounded-lg p-4">
                   <h4 className="font-medium mb-3">주문 관리</h4>
                   <Button 
                     onClick={() => handleSpecificDataCleanup('orders')}
                     disabled={cleanupLoading}
                     variant="outline"
                     size="sm"
                     className="w-full"
                   >
                     주문 데이터 삭제
                   </Button>
                 </div>
                 <div className="border rounded-lg p-4">
                   <h4 className="font-medium mb-3">고객 관리</h4>
                   <Button 
                     onClick={() => handleSpecificDataCleanup('customers')}
                     disabled={cleanupLoading}
                     variant="outline"
                     size="sm"
                     className="w-full"
                   >
                     고객 데이터 삭제
                   </Button>
                 </div>
                 <div className="border rounded-lg p-4">
                   <h4 className="font-medium mb-3">상품 관리</h4>
                   <Button 
                     onClick={() => handleSpecificDataCleanup('products')}
                     disabled={cleanupLoading}
                     variant="outline"
                     size="sm"
                     className="w-full"
                   >
                     상품 데이터 삭제
                   </Button>
                 </div>
                 <div className="border rounded-lg p-4">
                   <h4 className="font-medium mb-3">자재 관리</h4>
                   <Button 
                     onClick={() => handleSpecificDataCleanup('materials')}
                     disabled={cleanupLoading}
                     variant="outline"
                     size="sm"
                     className="w-full"
                   >
                     자재 데이터 삭제
                   </Button>
                 </div>
                 <div className="border rounded-lg p-4">
                   <h4 className="font-medium mb-3">간편지출</h4>
                   <Button 
                     onClick={() => handleSpecificDataCleanup('expenses')}
                     disabled={cleanupLoading}
                     variant="outline"
                     size="sm"
                     className="w-full"
                   >
                     지출 데이터 삭제
                   </Button>
                 </div>
                 <div className="border rounded-lg p-4">
                   <h4 className="font-medium mb-3">자재요청</h4>
                   <Button 
                     onClick={() => handleSpecificDataCleanup('materialRequests')}
                     disabled={cleanupLoading}
                     variant="outline"
                     size="sm"
                     className="w-full"
                   >
                     자재요청 데이터 삭제
                   </Button>
                 </div>
                 <div className="border rounded-lg p-4">
                   <h4 className="font-medium mb-3">직원 관리</h4>
                   <Button 
                     onClick={() => handleSpecificDataCleanup('employees')}
                     disabled={cleanupLoading}
                     variant="outline"
                     size="sm"
                     className="w-full"
                   >
                     직원 데이터 삭제
                   </Button>
                 </div>
                 <div className="border rounded-lg p-4">
                   <h4 className="font-medium mb-3">거래처 관리</h4>
                   <Button 
                     onClick={() => handleSpecificDataCleanup('partners')}
                     disabled={cleanupLoading}
                     variant="outline"
                     size="sm"
                     className="w-full"
                   >
                     거래처 데이터 삭제
                   </Button>
                 </div>
                 <div className="border rounded-lg p-4">
                   <h4 className="font-medium mb-3">재고이력</h4>
                   <Button 
                     onClick={() => handleSpecificDataCleanup('stockHistory')}
                     disabled={cleanupLoading}
                     variant="outline"
                     size="sm"
                     className="w-full"
                   >
                     재고이력 데이터 삭제
                   </Button>
                 </div>
                 <div className="border rounded-lg p-4">
                   <h4 className="font-medium mb-3">샘플앨범</h4>
                   <Button 
                     onClick={() => handleSpecificDataCleanup('albums')}
                     disabled={cleanupLoading}
                     variant="outline"
                     size="sm"
                     className="w-full"
                   >
                     샘플앨범 데이터 삭제
                   </Button>
                 </div>
               </div>
               {/* 진행률 표시 */}
               {progress && (
                 <div className="border rounded-lg p-4 bg-blue-50">
                   <h4 className="font-medium text-blue-800 mb-2">진행 상황</h4>
                   <div className="space-y-2">
                     <div className="flex justify-between text-sm">
                       <span>{progress.current}</span>
                       <span>{progress.completed}/{progress.total}</span>
                     </div>
                     <div className="w-full bg-gray-200 rounded-full h-2">
                       <div 
                         className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                         style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                       ></div>
                     </div>
                   </div>
                 </div>
               )}
               {/* 개별 데이터 삭제 확인 대화상자 */}
               <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                 <AlertDialogContent>
                   <AlertDialogHeader>
                     <AlertDialogTitle>⚠️ 데이터 삭제 확인</AlertDialogTitle>
                     <AlertDialogDescription>
                       정말로 {getDataTypeName(selectedDataType)} 데이터를 삭제하시겠습니까?<br />
                       <strong>이 작업은 되돌릴 수 없습니다.</strong>
                     </AlertDialogDescription>
                   </AlertDialogHeader>
                   <AlertDialogFooter>
                     <AlertDialogCancel>취소</AlertDialogCancel>
                     <AlertDialogAction
                       onClick={confirmSpecificDataCleanup}
                       className="bg-red-600 hover:bg-red-700"
                     >
                       삭제 확인
                     </AlertDialogAction>
                   </AlertDialogFooter>
                 </AlertDialogContent>
               </AlertDialog>
             </CardContent>
           </Card>
         </TabsContent>
      </Tabs>
      {/* 액션 버튼 */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={resetToDefaults}>
          <RefreshCw className="h-4 w-4 mr-2" />
          기본값으로 초기화
        </Button>
        <Button onClick={handleSaveSettings} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? '저장 중...' : '설정 저장'}
        </Button>
      </div>
    </div>
  );
} 
