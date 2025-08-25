"use client";

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, addDoc, writeBatch, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from './use-toast';

export interface DeliveryFee {
  id?: string;
  district: string;
  fee: number;
  freeThreshold?: number; // 무료배송 기준 금액
  createdAt?: any;
  updatedAt?: any;
}

export interface DeliverySettings {
  id?: string;
  defaultFee: number; // 기본 배송비
  freeThreshold: number; // 무료배송 기준 금액
  surcharges: {
    mediumItem?: number; // 중형 상품 추가비
    largeItem?: number; // 대형 상품 추가비
    express?: number; // 당일배송 추가비
  };
  createdAt?: any;
  updatedAt?: any;
}

// 기본 배송비 설정
const defaultDeliverySettings: Omit<DeliverySettings, 'id' | 'createdAt' | 'updatedAt'> = {
  defaultFee: 5000,
  freeThreshold: 50000,
  surcharges: {
    mediumItem: 3000,
    largeItem: 5000,
    express: 10000
  }
};

// 기본 지역별 배송비 (서울 기준)
const defaultDeliveryFees: Omit<DeliveryFee, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { district: '종로구', fee: 5000, freeThreshold: 50000 },
  { district: '중구', fee: 5000, freeThreshold: 50000 },
  { district: '용산구', fee: 5000, freeThreshold: 50000 },
  { district: '성동구', fee: 6000, freeThreshold: 50000 },
  { district: '광진구', fee: 6000, freeThreshold: 50000 },
  { district: '동대문구', fee: 6000, freeThreshold: 50000 },
  { district: '중랑구', fee: 7000, freeThreshold: 50000 },
  { district: '성북구', fee: 6000, freeThreshold: 50000 },
  { district: '강북구', fee: 7000, freeThreshold: 50000 },
  { district: '도봉구', fee: 8000, freeThreshold: 50000 },
  { district: '노원구', fee: 8000, freeThreshold: 50000 },
  { district: '은평구', fee: 7000, freeThreshold: 50000 },
  { district: '서대문구', fee: 6000, freeThreshold: 50000 },
  { district: '마포구', fee: 5000, freeThreshold: 50000 },
  { district: '양천구', fee: 7000, freeThreshold: 50000 },
  { district: '강서구', fee: 8000, freeThreshold: 50000 },
  { district: '구로구', fee: 7000, freeThreshold: 50000 },
  { district: '금천구', fee: 8000, freeThreshold: 50000 },
  { district: '영등포구', fee: 6000, freeThreshold: 50000 },
  { district: '동작구', fee: 6000, freeThreshold: 50000 },
  { district: '관악구', fee: 7000, freeThreshold: 50000 },
  { district: '서초구', fee: 6000, freeThreshold: 50000 },
  { district: '강남구', fee: 6000, freeThreshold: 50000 },
  { district: '송파구', fee: 7000, freeThreshold: 50000 },
  { district: '강동구', fee: 8000, freeThreshold: 50000 }
];

export function useDeliveryFees() {
  const [deliveryFees, setDeliveryFees] = useState<DeliveryFee[]>([]);
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // 배송비 정보 조회
  const fetchDeliveryFees = useCallback(async () => {
    try {
      setLoading(true);
      
      // 지역별 배송비 조회
      const feesSnapshot = await getDocs(collection(db, 'deliveryFees'));
      const fees: DeliveryFee[] = feesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DeliveryFee[];
      
      // 배송 설정 조회
      const settingsSnapshot = await getDocs(collection(db, 'deliverySettings'));
      let settings: DeliverySettings | null = null;
      if (!settingsSnapshot.empty) {
        const settingsDoc = settingsSnapshot.docs[0];
        settings = {
          id: settingsDoc.id,
          ...settingsDoc.data()
        } as DeliverySettings;
      }
      
      setDeliveryFees(fees);
      setDeliverySettings(settings);
      
      console.log('배송비 데이터 조회 완료:', {
        feesCount: fees.length,
        settings: settings ? '있음' : '없음'
      });
    } catch (error) {
      console.error('배송비 정보 조회 오류:', error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '배송비 정보를 불러오는 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // 배송비 설정 초기화
  const initializeDeliveryData = useCallback(async () => {
    try {
      console.log('배송비 데이터 초기화 시작');
      const deliveryFeesCollection = collection(db, 'deliveryFees');
      const deliverySettingsCollection = collection(db, 'deliverySettings');
      
      // 기존 데이터 확인
      const feesSnapshot = await getDocs(deliveryFeesCollection);
      const settingsSnapshot = await getDocs(deliverySettingsCollection);
      
      console.log('기존 데이터 확인:', {
        feesCount: feesSnapshot.size,
        settingsCount: settingsSnapshot.size
      });
      
      const batch = writeBatch(db);
      
      // 배송비 설정이 없으면 생성
      if (settingsSnapshot.empty) {
        console.log('배송 설정 생성 중...');
        const settingsDoc = doc(deliverySettingsCollection);
        batch.set(settingsDoc, {
          ...defaultDeliverySettings,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      // 지역별 배송비가 없으면 생성
      if (feesSnapshot.empty) {
        console.log('지역별 배송비 생성 중...');
        for (const fee of defaultDeliveryFees) {
          const feeDoc = doc(deliveryFeesCollection);
          batch.set(feeDoc, {
            ...fee,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }
      
      await batch.commit();
      console.log('배송비 데이터 초기화 완료');
      
      // 초기화 후 즉시 재조회
      await fetchDeliveryFees();
    } catch (error) {
      console.error('배송비 데이터 초기화 오류:', error);
    }
  }, [fetchDeliveryFees]);

  useEffect(() => {
    fetchDeliveryFees();
  }, [fetchDeliveryFees]);

  // 지역으로 배송비 찾기
  const getDeliveryFeeByDistrict = useCallback((district: string): number => {
    const fee = deliveryFees.find(fee => fee.district === district);
    return fee?.fee || deliverySettings?.defaultFee || 5000;
  }, [deliveryFees, deliverySettings]);

  // 무료배송 기준 확인
  const isFreeDelivery = useCallback((district: string, orderAmount: number): boolean => {
    const fee = deliveryFees.find(fee => fee.district === district);
    const threshold = fee?.freeThreshold || deliverySettings?.freeThreshold || 50000;
    return orderAmount >= threshold;
  }, [deliveryFees, deliverySettings]);

  // 기존 API 호환성을 위한 함수들
  const updateDeliveryFee = async (id: string, feeData: Partial<DeliveryFee>) => {
    try {
      const docRef = doc(db, 'deliveryFees', id);
      await setDoc(docRef, {
        ...feeData,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      toast({
        title: '성공',
        description: '지역별 배송비가 수정되었습니다.',
      });
      
      await fetchDeliveryFees();
    } catch (error) {
      console.error('배송비 수정 오류:', error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '배송비 수정 중 오류가 발생했습니다.',
      });
    }
  };

  // 새로운 지역 추가
  const addNewDistrict = async (district: string, fee: number) => {
    try {
      // 중복 확인
      const existingFee = deliveryFees.find(f => f.district === district);
      if (existingFee) {
        toast({
          variant: 'destructive',
          title: '오류',
          description: '이미 존재하는 지역입니다.',
        });
        return;
      }

      const docRef = await addDoc(collection(db, 'deliveryFees'), {
        district,
        fee,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      toast({
        title: '성공',
        description: '새 지역이 추가되었습니다.',
      });
      
      await fetchDeliveryFees();
    } catch (error) {
      console.error('새 지역 추가 오류:', error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '새 지역 추가 중 오류가 발생했습니다.',
      });
    }
  };

  // 지역 삭제
  const deleteDistrict = async (id: string, districtName: string) => {
    try {
      if (!confirm(`"${districtName}" 지역을 삭제하시겠습니까?`)) {
        return;
      }

      await deleteDoc(doc(db, 'deliveryFees', id));
      
      toast({
        title: '성공',
        description: '지역이 삭제되었습니다.',
      });
      
      await fetchDeliveryFees();
    } catch (error) {
      console.error('지역 삭제 오류:', error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '지역 삭제 중 오류가 발생했습니다.',
      });
    }
  };

  // 중복 데이터 제거
  const removeDuplicateDistricts = async () => {
    try {
      const districtCounts = new Map<string, DeliveryFee[]>();
      
      // 지역별로 그룹화
      deliveryFees.forEach(fee => {
        if (!districtCounts.has(fee.district)) {
          districtCounts.set(fee.district, []);
        }
        districtCounts.get(fee.district)!.push(fee);
      });
      
      const batch = writeBatch(db);
      let removedCount = 0;
      
      // 중복된 지역 처리
      districtCounts.forEach((fees, district) => {
        if (fees.length > 1) {
          // 가장 최근에 업데이트된 것을 제외하고 나머지 삭제
          const sortedFees = fees.sort((a, b) => {
            const aTime = a.updatedAt?.toDate?.() || new Date(0);
            const bTime = b.updatedAt?.toDate?.() || new Date(0);
            return bTime.getTime() - aTime.getTime();
          });
          
          // 첫 번째(최신)를 제외하고 나머지 삭제
          for (let i = 1; i < sortedFees.length; i++) {
            if (sortedFees[i].id) {
              batch.delete(doc(db, 'deliveryFees', sortedFees[i].id!));
              removedCount++;
            }
          }
        }
      });
      
      if (removedCount > 0) {
        await batch.commit();
        toast({
          title: '성공',
          description: `${removedCount}개의 중복 데이터가 제거되었습니다.`,
        });
        await fetchDeliveryFees();
      } else {
        toast({
          title: '알림',
          description: '중복 데이터가 없습니다.',
        });
      }
    } catch (error) {
      console.error('중복 데이터 제거 오류:', error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '중복 데이터 제거 중 오류가 발생했습니다.',
      });
    }
  };

  return {
    deliveryFees,
    loading,
    fetchDeliveryFees,
    updateDeliveryFee,
    addNewDistrict,
    deleteDistrict,
    removeDuplicateDistricts,
    getDeliveryFeeByDistrict,
    // 기존 API 호환성
    refetch: fetchDeliveryFees
  };
}
