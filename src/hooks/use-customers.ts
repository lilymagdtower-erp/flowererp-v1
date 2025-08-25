"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface Customer {
  id: string;
  name: string;
  contact: string;
  email?: string;
  address?: string;
  memo?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // 고객 목록 가져오기
  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const customersRef = collection(db, "customers");
      const q = query(customersRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      
      const customersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      
      setCustomers(customersData);
    } catch (error) {
      console.error("고객 목록을 가져오는 중 오류 발생:", error);
    } finally {
      setLoading(false);
    }
  };

  // 고객 추가
  const addCustomer = async (customerData: Omit<Customer, "id" | "createdAt" | "updatedAt">) => {
    try {
      // 중복 체크: 이름과 연락처가 모두 일치하면 중복으로 처리
      const nameQuery = query(collection(db, "customers"), where("name", "==", customerData.name));
      const contactQuery = query(collection(db, "customers"), where("contact", "==", customerData.contact));
      
      const [nameSnapshot, contactSnapshot] = await Promise.all([
        getDocs(nameQuery),
        getDocs(contactQuery)
      ]);
      
      // 중복 조건: 이름과 연락처가 모두 일치하는 고객이 있으면 중복
      const isDuplicate = !nameSnapshot.empty && !contactSnapshot.empty;
      
      if (isDuplicate) {
        throw new Error("이미 등록된 고객입니다. 이름과 연락처가 동일한 고객이 존재합니다.");
      }
      
      const now = Timestamp.now();
      const docRef = await addDoc(collection(db, "customers"), {
        ...customerData,
        createdAt: now,
        updatedAt: now
      });
      
      await fetchCustomers();
      return docRef.id;
    } catch (error) {
      console.error("고객 추가 중 오류 발생:", error);
      throw error;
    }
  };

  // 고객 수정
  const updateCustomer = async (id: string, customerData: Partial<Omit<Customer, "id" | "createdAt" | "updatedAt">>) => {
    try {
      const customerRef = doc(db, "customers", id);
      await updateDoc(customerRef, {
        ...customerData,
        updatedAt: Timestamp.now()
      });
      
      await fetchCustomers();
    } catch (error) {
      console.error("고객 수정 중 오류 발생:", error);
      throw error;
    }
  };

  // 고객 삭제
  const deleteCustomer = async (id: string) => {
    try {
      await deleteDoc(doc(db, "customers", id));
      await fetchCustomers();
    } catch (error) {
      console.error("고객 삭제 중 오류 발생:", error);
      throw error;
    }
  };

  // 고객 검색
  const searchCustomers = async (searchTerm: string) => {
    try {
      setLoading(true);
      const customersRef = collection(db, "customers");
      const q = query(
        customersRef,
        where("name", ">=", searchTerm),
        where("name", "<=", searchTerm + "\uf8ff"),
        orderBy("name")
      );
      const querySnapshot = await getDocs(q);
      
      const customersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      
      setCustomers(customersData);
    } catch (error) {
      console.error("고객 검색 중 오류 발생:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  return {
    customers,
    loading,
    fetchCustomers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    searchCustomers
  };
}
