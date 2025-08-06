"use client";

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, addDoc, serverTimestamp, query, where, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from './use-toast';
import { PartnerFormValues } from '@/app/dashboard/partners/components/partner-form';

export interface Partner extends PartnerFormValues {
  id: string;
  createdAt: string;
}

export function usePartners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPartners = useCallback(async () => {
    try {
      setLoading(true);
      const partnersCollection = collection(db, 'partners');
      const partnersData = (await getDocs(partnersCollection)).docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        } as Partner;
      });
      setPartners(partnersData);
    } catch (error) {
      console.error("Error fetching partners: ", error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '거래처 정보를 불러오는 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const addPartner = async (data: PartnerFormValues) => {
    setLoading(true);
    try {
      const partnerWithTimestamp = {
        ...data,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'partners'), partnerWithTimestamp);
      toast({ title: "성공", description: "새 거래처가 추가되었습니다." });
      await fetchPartners();
    } catch (error) {
      console.error("Error adding partner:", error);
      toast({ variant: 'destructive', title: '오류', description: '거래처 추가 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const updatePartner = async (id: string, data: PartnerFormValues) => {
    setLoading(true);
    try {
      const partnerDocRef = doc(db, 'partners', id);
      await setDoc(partnerDocRef, data, { merge: true });
      toast({ title: "성공", description: "거래처 정보가 수정되었습니다." });
      await fetchPartners();
    } catch (error) {
      console.error("Error updating partner:", error);
      toast({ variant: 'destructive', title: '오류', description: '거래처 정보 수정 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const deletePartner = async (id: string) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'partners', id));
      toast({ title: "성공", description: "거래처 정보가 삭제되었습니다." });
      await fetchPartners();
    } catch (error) {
      console.error("Error deleting partner:", error);
      toast({ variant: 'destructive', title: '오류', description: '거래처 삭제 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const bulkAddPartners = async (data: any[]) => {
    setLoading(true);
    let newCount = 0;
    let updateCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    await Promise.all(data.map(async (row) => {
      try {
        if (!row.name || !row.type) return;

        const partnerData = {
          name: String(row.name),
          type: String(row.type),
          contact: String(row.contact || ''),
          contactPerson: String(row.contactPerson || ''),
          email: String(row.email || ''),
          address: String(row.address || ''),
          branch: String(row.branch || ''),
          memo: String(row.memo || ''),
        };

        // 중복 체크: 거래처명, 연락처, 담당자 중 하나라도 일치하면 중복으로 처리
        const nameQuery = query(collection(db, "partners"), where("name", "==", partnerData.name));
        const contactQuery = query(collection(db, "partners"), where("contact", "==", partnerData.contact));
        const contactPersonQuery = query(collection(db, "partners"), where("contactPerson", "==", partnerData.contactPerson));

        const [nameSnapshot, contactSnapshot, contactPersonSnapshot] = await Promise.all([
          getDocs(nameQuery),
          getDocs(contactQuery),
          getDocs(contactPersonQuery)
        ]);

        // 중복 조건: 거래처명이 같거나, 연락처가 같거나, 담당자가 같으면 중복
        const isDuplicate = !nameSnapshot.empty || 
                           (!partnerData.contact && !contactSnapshot.empty) || 
                           (!partnerData.contactPerson && !contactPersonSnapshot.empty);

        if (isDuplicate) {
          duplicateCount++;
          return; // 중복 데이터는 저장하지 않음
        }

        // 중복이 아닌 경우에만 새로 추가
        const docRef = doc(collection(db, "partners"));
        await setDoc(docRef, { ...partnerData, createdAt: serverTimestamp() });
        newCount++;

      } catch (error) {
        console.error("Error processing row:", row, error);
        errorCount++;
      }
    }));

    setLoading(false);
    
    if (errorCount > 0) {
      toast({ 
        variant: 'destructive', 
        title: '일부 처리 오류', 
        description: `${errorCount}개 항목 처리 중 오류가 발생했습니다.` 
      });
    }
    
    toast({ 
      title: '처리 완료', 
      description: `성공: 신규 거래처 ${newCount}개 추가, 중복 데이터 ${duplicateCount}개 제외.`
    });
    
    await fetchPartners();
  };
  
  return { partners, loading, addPartner, updatePartner, deletePartner, bulkAddPartners };
}
