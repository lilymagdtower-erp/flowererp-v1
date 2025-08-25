
"use client";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { MinusCircle, PlusCircle, Trash2, Store, Search, Calendar as CalendarIcon, ChevronDown, ChevronUp, Loader2, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
// 20번째 줄 - 이것은 유지
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useOrders, OrderData, Order } from "@/hooks/use-orders";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useProducts, Product } from "@/hooks/use-products";
import { useCustomers, Customer } from "@/hooks/use-customers";
import { useAuth } from "@/hooks/use-auth";
import { useDiscountSettings } from "@/hooks/use-discount-settings";
import { useSettings } from "@/hooks/use-settings";
import { useDeliveryFees } from "@/hooks/use-delivery-fees";
import { Timestamp } from "firebase/firestore";
import { debounce } from "lodash";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
interface OrderItem extends Product {
  quantity: number;
  isCustomProduct?: boolean; // 수동 추가 상품 여부
}
type OrderType = "store" | "phone" | "naver" | "kakao" | "etc";
type ReceiptType = "store_pickup" | "pickup_reservation" | "delivery_reservation";
type MessageType = "card" | "ribbon";
type PaymentMethod = "card" | "cash" | "transfer" | "mainpay" | "shopping_mall" | "epay";
type PaymentStatus = "pending" | "paid";
declare global {
  interface Window {
    daum: any;
  }
}
export default function NewOrderPage() {
  const { user } = useAuth();

  const { products: allProducts, loading: productsLoading } = useProducts();
  const { orders, loading: ordersLoading, addOrder, updateOrder } = useOrders();
  const { findCustomersByContact, customers } = useCustomers();
  const { discountSettings, canApplyDiscount, getActiveDiscountRates } = useDiscountSettings();
  const { settings } = useSettings();
  const { deliveryFees, loading: deliveryFeesLoading, getDeliveryFeeByDistrict } = useDeliveryFees();
  const router = useRouter();
  
  // 배송비 계산 함수
  const calculateDeliveryFee = (address: string) => {
    // 주소에서 지역 추출
    const extractDistrictFromAddress = (address: string) => {
      // 서울시 강남구, 경기도 성남시 등에서 구/시 추출
      const match = address.match(/(?:시|도)\s*([가-힣]+구|[가-힣]+시|[가-힣]+군)/);
      return match ? match[1] : '';
    };
    
    const district = extractDistrictFromAddress(address);
    const fee = getDeliveryFeeByDistrict(district);
    
    return { fee, district };
  };
  const searchParams = useSearchParams();
  const orderId = searchParams.get('id');
  
  // 수동 상품 추가 관련 상태
  const [isCustomProductDialogOpen, setIsCustomProductDialogOpen] = useState(false);
  const [customProductName, setCustomProductName] = useState("");
  const [customProductPrice, setCustomProductPrice] = useState("");
  const [customProductQuantity, setCustomProductQuantity] = useState(1);
  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.customer-search-container')) {
        setIsCustomerSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const { toast } = useToast();
  const [deliveryFeeType, setDeliveryFeeType] = useState<"auto" | "manual">("auto");
  const [manualDeliveryFee, setManualDeliveryFee] = useState(0);
  const [calculatedDeliveryFee, setCalculatedDeliveryFee] = useState(0);
  const [selectedDistrict, setSelectedDistrict] = useState("");
  // 단독샵이므로 지역별 배송비 제거
  const [ordererName, setOrdererName] = useState("");
  const [ordererContact, setOrdererContact] = useState("");
  const [ordererCompany, setOrdererCompany] = useState("");
  const [ordererEmail, setOrdererEmail] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [registerCustomer, setRegisterCustomer] = useState(true);
  const [contactSearchResults, setContactSearchResults] = useState<Customer[]>([]);
  const [isContactSearchOpen, setIsContactSearchOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [usedPoints, setUsedPoints] = useState(0);
  // 할인율 관련 상태
  const [selectedDiscountRate, setSelectedDiscountRate] = useState<number>(0);
  const [customDiscountRate, setCustomDiscountRate] = useState<number>(0);
  // 고객 검색 관련 상태
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>("store");
  const [receiptType, setReceiptType] = useState<ReceiptType>("store_pickup");
  // 단독샵이므로 지점 관련 코드 제거
  // 현재 시간을 30분 단위로 반올림하는 함수
  const getInitialTime = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    // 30분 단위로 반올림
    const roundedMinutes = minutes < 15 ? 0 : minutes < 45 ? 30 : 0;
    const adjustedHours = minutes >= 45 ? hours + 1 : hours;
    // 영업시간 체크 (7:30 - 22:00)
    if (adjustedHours < 7 || (adjustedHours === 7 && roundedMinutes < 30)) {
      return "07:30"; // 영업시간 전이면 첫 영업시간
    } else if (adjustedHours >= 22) {
      return "07:30"; // 영업시간 후면 다음날 첫 영업시간
    }
    return `${String(adjustedHours).padStart(2, '0')}:${String(roundedMinutes).padStart(2, '0')}`;
  };
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(new Date());
  const [scheduleTime, setScheduleTime] = useState(getInitialTime());
  const [pickerName, setPickerName] = useState("");
  const [pickerContact, setPickerContact] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientContact, setRecipientContact] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryAddressDetail, setDeliveryAddressDetail] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("card");
  const [messageContent, setMessageContent] = useState("");
  const [messageSender, setMessageSender] = useState("");
  const [specialRequest, setSpecialRequest] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("paid");
  const [showTodaysOrders, setShowTodaysOrders] = useState(false);
  const [existingOrder, setExistingOrder] = useState<Order | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMainCategory, setSelectedMainCategory] = useState<string | null>(null);
  const [selectedMidCategory, setSelectedMidCategory] = useState<string | null>(null);
  const timeOptions = useMemo(() => {
    const options = [];
    for (let h = 7; h <= 22; h++) {
        for (let m = 0; m < 60; m += 30) {
            if (h === 7 && m < 30) continue;
            if (h === 22 && m > 0) continue;
            const hour = String(h).padStart(2, '0');
            const minute = String(m).padStart(2, '0');
            options.push(`${hour}:${minute}`);
        }
    }
    return options;
  }, []);
  // 단독샵이므로 모든 상품 표시
  const branchProducts = useMemo(() => {
    return allProducts;
  }, [allProducts]);
  const mainCategories = useMemo(() => [...new Set(branchProducts.map(p => p.mainCategory).filter(Boolean))], [branchProducts]);
  const midCategories = useMemo(() => {
    if (!selectedMainCategory) return [];
    return [...new Set(branchProducts.filter(p => p.mainCategory === selectedMainCategory).map(p => p.midCategory).filter(Boolean))];
  }, [branchProducts, selectedMainCategory]);
  const filteredProducts = useMemo(() => {
    const filtered = branchProducts.filter(p => 
        (!selectedMainCategory || p.mainCategory === selectedMainCategory) &&
        (!selectedMidCategory || p.midCategory === selectedMidCategory)
    );
    
    // 가격순 오름차순 정렬
    return filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
  }, [branchProducts, selectedMainCategory, selectedMidCategory]);
  const todaysOrders = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return orders.filter(order => {
      if (!order.orderDate) return false;
      const orderDate = (order.orderDate as Timestamp).toDate();
      orderDate.setHours(0,0,0,0);
      return orderDate.getTime() === today.getTime();
    })
  }, [orders]);
  // 단독샵이므로 사용자 역할별 지점 선택 제거
  useEffect(() => {
      if (orderId && !ordersLoading && orders.length > 0 && !productsLoading && allProducts.length > 0) {
        const foundOrder = orders.find(o => o.id === orderId);
        if(foundOrder) {
            setExistingOrder(foundOrder);
            setOrderItems(foundOrder.items.map(item => {
                const product = allProducts.find(p => p.id === item.id);
                return { ...product!, quantity: item.quantity };
            }).filter(item => item.id)); 
            // 단독샵이므로 배송비는 직접 입력만 가능
            setDeliveryFeeType("manual");
            setManualDeliveryFee(foundOrder.summary.deliveryFee);
            setOrdererName(foundOrder.orderer.name);
            setOrdererContact(foundOrder.orderer.contact);
            setOrdererCompany(foundOrder.orderer.company || "");
            setOrdererEmail(foundOrder.orderer.email || "");
            setIsAnonymous(foundOrder.isAnonymous);
            setOrderType(foundOrder.orderType);
            // 기존 데이터와의 호환성을 위한 타입 변환
            const legacyReceiptType = foundOrder.receiptType as any;
            if (legacyReceiptType === 'pickup') {
              setReceiptType('store_pickup');
            } else if (legacyReceiptType === 'delivery') {
              setReceiptType('delivery_reservation');
            } else {
              setReceiptType(foundOrder.receiptType as ReceiptType);
            }
            const schedule = foundOrder.pickupInfo || foundOrder.deliveryInfo;
            if(schedule) {
              setScheduleDate(schedule.date ? new Date(schedule.date) : new Date());
              setScheduleTime(schedule.time);
            }
            if(foundOrder.pickupInfo){
              setPickerName(foundOrder.pickupInfo.pickerName);
              setPickerContact(foundOrder.pickupInfo.pickerContact);
            }
            if(foundOrder.deliveryInfo){
              setRecipientName(foundOrder.deliveryInfo.recipientName);
              setRecipientContact(foundOrder.deliveryInfo.recipientContact);
              setDeliveryAddress(foundOrder.deliveryInfo.address);
              setDeliveryAddressDetail(""); 
            }
            setMessageType(foundOrder.message.type);
            // 메시지 내용에서 보내는 사람 분리
            const messageParts = foundOrder.message.content.split('\n---\n');
            if (messageParts.length > 1) {
              setMessageContent(messageParts[0]);
              setMessageSender(messageParts[1]);
            } else {
              setMessageContent(foundOrder.message.content);
              setMessageSender("");
            }
            setSpecialRequest(foundOrder.request || "");
            setPaymentMethod(foundOrder.payment.method);
            setPaymentStatus(foundOrder.payment.status as PaymentStatus);
        }
      }
  }, [orderId, orders, ordersLoading, allProducts, productsLoading])
  useEffect(() => {
    if (receiptType === 'store_pickup' || receiptType === 'pickup_reservation') {
      setPickerName(ordererName);
      setPickerContact(ordererContact);
      setDeliveryFeeType("manual");
      setManualDeliveryFee(0);
      // 매장픽업(즉시)일 때는 현재 날짜와 시간으로 설정
      if (receiptType === 'store_pickup') {
        setScheduleDate(new Date());
        setScheduleTime(getInitialTime());
      }
    } else if (receiptType === 'delivery_reservation') {
      // 배송일 경우 주문자 정보를 수령자 정보에 자동 입력
      setRecipientName(ordererName);
      setRecipientContact(ordererContact);
      // 배송일 경우 기본값을 자동계산으로 설정
      setDeliveryFeeType("auto");
    }
  }, [ordererName, ordererContact, receiptType]);
  // 배송비 자동 계산 로직
  // 무료배송비 관련 코드 제거됨

  // 배송지 주소 변경 시 배송비 자동 계산
  useEffect(() => {
    if (receiptType === 'delivery_reservation' && deliveryFeeType === 'auto' && deliveryAddress) {
      // 주소에서 지역(구) 추출하는 함수
      const extractDistrictFromAddress = (address: string): string => {
        if (!address) return "";
        
        // 서울특별시, 서울시 등의 패턴을 찾아서 구 단위 추출
        const seoulPattern = /(서울특별시|서울시?)\s*([가-힣]+구)/;
        const match = address.match(seoulPattern);
        
        if (match && match[2]) {
          return match[2]; // 구 단위 반환 (예: "영등포구")
        }
        
        // 다른 시도 패턴들도 추가 가능
        const otherPattern = /([가-힣]+시)\s*([가-힣]+구)/;
        const otherMatch = address.match(otherPattern);
        
        if (otherMatch && otherMatch[2]) {
          return otherMatch[2];
        }
        
        return "";
      };

      // 배송비 자동 계산 함수
      const calculateDeliveryFee = (address: string): { fee: number; district: string } => {
        if (!address) {
          return { fee: 0, district: "" };
        }

        const district = extractDistrictFromAddress(address);
        if (!district) {
          return { fee: 0, district: "" };
        }

        // 새로운 배송비 시스템 사용
        const fee = getDeliveryFeeByDistrict(district);
        return { fee, district };
      };

      const { fee, district } = calculateDeliveryFee(deliveryAddress);
      setCalculatedDeliveryFee(fee);
      setSelectedDistrict(district);
    } else {
      setCalculatedDeliveryFee(0);
      setSelectedDistrict("");
    }
  }, [deliveryAddress, deliveryFeeType, receiptType, orderItems, getDeliveryFeeByDistrict]);
  const deliveryFee = useMemo(() => {
    if (receiptType === 'store_pickup' || receiptType === 'pickup_reservation') return 0;
    
    if (deliveryFeeType === 'manual') {
      return manualDeliveryFee;
    }
    
    return calculatedDeliveryFee;
  }, [deliveryFeeType, manualDeliveryFee, receiptType, calculatedDeliveryFee]);
  const debouncedSearch = useCallback(
    debounce(async (contact: string) => {
      if (contact.length >= 4) {
        const results = await findCustomersByContact(contact);
        setContactSearchResults(results);
        if (results.length > 0) {
            setIsContactSearchOpen(true);
        } else {
            setIsContactSearchOpen(false);
        }
      } else {
        setContactSearchResults([]);
        setIsContactSearchOpen(false);
      }
    }, 300),
    [findCustomersByContact]
  );
const handleOrdererContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const formattedPhoneNumber = formatPhoneNumber(e.target.value);
  setOrdererContact(formattedPhoneNumber);
  // 고객 검색 실행
  if (formattedPhoneNumber.replace(/[^0-9]/g, '').length >= 4) {
    debouncedSearch(formattedPhoneNumber);
  } else {
    setContactSearchResults([]);
    setIsContactSearchOpen(false);
    setSelectedCustomer(null);
  }
};
  const formatPhoneNumber = (value: string) => {
    if (!value) return value;
    const phoneNumber = value.replace(/[^\d]/g, '');
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 8) {
      return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`;
    }
    return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 7)}-${phoneNumber.slice(7, 11)}`;
  }


  const handleGenericContactChange = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string>>) => {
    const formattedPhoneNumber = formatPhoneNumber(e.target.value);
    setter(formattedPhoneNumber);
  }
  const handleAddProduct = (docId: string) => {
    const productToAdd = branchProducts.find(p => p.docId === docId);
    if (!productToAdd) return;
    setOrderItems(prevItems => {
        const existingItem = prevItems.find(item => item.docId === productToAdd.docId);
        if (existingItem) {
            const newQuantity = existingItem.quantity + 1;
            if (newQuantity > existingItem.stock) {
                toast({ variant: 'destructive', title: '재고 부족', description: `최대 주문 가능 수량은 ${existingItem.stock}개 입니다.` });
                return prevItems;
            }
            return prevItems.map(item => item.docId === productToAdd.docId ? { ...item, quantity: newQuantity } : item);
        } else {
             if (productToAdd.stock < 1) {
                toast({ variant: 'destructive', title: '재고 없음', description: '선택하신 상품은 재고가 없습니다.' });
                return prevItems;
            }
            return [...prevItems, { ...productToAdd, quantity: 1 }];
        }
    });
  };
  const updateItemQuantity = (docId: string, newQuantity: number) => {
    const itemToUpdate = orderItems.find(item => item.docId === docId);
    if (!itemToUpdate) return;
    
    // 수동 추가 상품은 재고 제한 없음
    if (itemToUpdate.isCustomProduct) {
      if (newQuantity > 0) {
        setOrderItems(orderItems.map(item => item.docId === docId ? { ...item, quantity: newQuantity } : item));
      }
      return;
    }
    
    // 일반 상품은 재고 체크
    if (newQuantity > 0 && newQuantity <= itemToUpdate.stock) {
      setOrderItems(orderItems.map(item => item.docId === docId ? { ...item, quantity: newQuantity } : item));
    } else if (newQuantity > itemToUpdate.stock) {
        toast({ variant: 'destructive', title: '재고 부족', description: `최대 주문 가능 수량은 ${itemToUpdate.stock}개 입니다.` });
    }
  };
  const removeItem = (docId: string) => {
    setOrderItems(orderItems.filter(item => item.docId !== docId));
  };

  // 수동 상품 추가 함수
  const handleAddCustomProduct = () => {
    if (!customProductName.trim() || !customProductPrice.trim()) {
      toast({ variant: 'destructive', title: '입력 오류', description: '상품명과 가격을 모두 입력해주세요.' });
      return;
    }

    const price = Number(customProductPrice);
    if (isNaN(price) || price <= 0) {
      toast({ variant: 'destructive', title: '가격 오류', description: '올바른 가격을 입력해주세요.' });
      return;
    }

    if (customProductQuantity <= 0) {
      toast({ variant: 'destructive', title: '수량 오류', description: '올바른 수량을 입력해주세요.' });
      return;
    }

    // 임시 상품 생성 (주문에만 추가, DB에는 저장하지 않음)
    const customProduct: OrderItem = {
      id: `custom_${Date.now()}`, // 임시 ID 생성
      docId: `custom_${Date.now()}`,
      name: customProductName.trim(),
      price: price,
      quantity: customProductQuantity,
      stock: 999, // 수동 상품은 재고 제한 없음
      mainCategory: "기타",
      midCategory: "수동 추가",
      supplier: "수동 등록",
      size: "기타",
      color: "기타",
              branch: "단독샵", // 단독샵 기본값
      status: "active",
      isCustomProduct: true, // 수동 추가 상품 표시
    };

    setOrderItems(prevItems => [...prevItems, customProduct]);
    
    // 다이얼로그 초기화 및 닫기
    setCustomProductName("");
    setCustomProductPrice("");
    setCustomProductQuantity(1);
    setIsCustomProductDialogOpen(false);
    
    toast({ title: '상품 추가 완료', description: `${customProductName}이(가) 주문에 추가되었습니다.` });
  };
  const handleCompleteOrder = async () => {
    setIsSubmitting(true);
    if (orderItems.length === 0) {
      toast({ variant: 'destructive', title: '주문 오류', description: '주문할 상품을 추가해주세요.' });
      setIsSubmitting(false);
      return;
    }
    const orderPayload: OrderData = {
        branchId: "default", // 단독샵 기본값
        branchName: "단독샵", // 단독샵 기본값
        orderDate: existingOrder?.orderDate || new Date(),
        status: existingOrder?.status || 'processing', 
        orderType: orderType,
        receiptType: receiptType,
        items: orderItems.map(({id, name, quantity, price}) => ({id, name, quantity, price})),
        summary: {
          subtotal: orderSummary.subtotal,
          discountAmount: orderSummary.discountAmount,
          discountRate: orderSummary.discountRate,
          deliveryFee: orderSummary.deliveryFee,
          pointsUsed: orderSummary.pointsUsed,
          pointsEarned: orderSummary.pointsEarned,
          total: orderSummary.total,
        },
        orderer: { id: selectedCustomer?.id || "", name: ordererName, contact: ordererContact, company: ordererCompany, email: ordererEmail },
        isAnonymous: isAnonymous,
        registerCustomer: registerCustomer,
        payment: {
            method: paymentMethod,
            status: paymentStatus === "paid" ? "completed" : paymentStatus,
        },
        pickupInfo: (receiptType === 'store_pickup' || receiptType === 'pickup_reservation') ? { 
            date: scheduleDate ? format(scheduleDate, "yyyy-MM-dd") : '', 
            time: scheduleTime, 
            pickerName, 
            pickerContact 
        } : null,
        deliveryInfo: receiptType === 'delivery_reservation' ? { 
            date: scheduleDate ? format(scheduleDate, "yyyy-MM-dd") : '', 
            time: scheduleTime,
            recipientName, 
            recipientContact, 
            address: `${deliveryAddress} ${deliveryAddressDetail}`,
            district: '', // 단독샵이므로 지역 정보 제거
        } : null,
        message: { 
          type: messageType, 
          content: messageSender ? `${messageContent}\n---\n${messageSender}` : messageContent 
        },
        request: specialRequest,
    };
    try {
      if (existingOrder) {
        await updateOrder(existingOrder.id, orderPayload);
      } else {
        await addOrder(orderPayload);
      }
      router.push('/dashboard/orders');
    } catch (error) {
      // Error is already handled in the hook
    } finally {
      setIsSubmitting(false);
    }
  }
  // 단독샵이므로 지점 디버깅 코드 제거
  // 단독샵이므로 지점 관련 기능 제거
const handleCustomerSelect = (customer: Customer) => {
  setSelectedCustomer(customer);
  setOrdererName(customer.name);
  setOrdererCompany(customer.companyName || "");
  setOrdererEmail(customer.email || "");
  setOrdererContact(customer.contact);
  setIsContactSearchOpen(false);
  setUsedPoints(0);
};
const handleCustomerSearch = async (query: string) => {
  if (!query.trim()) {
    setCustomerSearchResults([]);
    return;
  }
  setCustomerSearchLoading(true);
  try {
    let results = customers;
    const searchTerm = query.toLowerCase().trim();
    // 통합 검색: 회사명, 주문자명, 연락처 뒷4자리로 검색
    results = results.filter(c => {
      const companyMatch = c.companyName?.toLowerCase().includes(searchTerm);
      const nameMatch = c.name.toLowerCase().includes(searchTerm);
      const contactMatch = c.contact.replace(/[^0-9]/g, '').endsWith(searchTerm);
      return companyMatch || nameMatch || contactMatch;
    });
    setCustomerSearchResults(results);
  } catch (error) {
    console.error('고객 검색 오류:', error);
    toast({
      variant: 'destructive',
      title: '검색 오류',
      description: '고객 검색 중 오류가 발생했습니다.',
    });
  } finally {
    setCustomerSearchLoading(false);
  }
};
// 디바운스된 검색 함수
const debouncedCustomerSearch = useCallback(
  debounce((query: string) => {
    handleCustomerSearch(query);
  }, 300),
  [customers]
);
  const orderSummary = useMemo(() => {
    const subtotal = orderItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
    // 할인율 적용
    const discountRate = selectedDiscountRate > 0 ? selectedDiscountRate : customDiscountRate;
    const discountAmount = Math.floor(subtotal * (discountRate / 100));
    const discountedSubtotal = subtotal - discountAmount;
    // 포인트 사용 가능 여부 확인
    const canUsePoints = selectedCustomer && discountedSubtotal >= 5000;
    const maxUsablePoints = canUsePoints ? Math.min(selectedCustomer.points || 0, discountedSubtotal) : 0;
    const pointsToUse = Math.min(discountedSubtotal, usedPoints, maxUsablePoints);
    // 최종 금액 계산
    const finalSubtotal = discountedSubtotal - pointsToUse;
    const total = finalSubtotal + deliveryFee;
    // 포인트 적립 계산 (할인 설정에 따라)
    const shouldAccumulatePoints = discountSettings?.globalSettings?.allowPointAccumulation ?? true;
    const pointsEarned = shouldAccumulatePoints ? Math.floor(finalSubtotal * 0.02) : 0;
    return { 
      subtotal, 
      discountedSubtotal,
      discountAmount,
      discountRate,
      deliveryFee, 
      pointsUsed: pointsToUse, 
      pointsEarned, 
      total, 
      availablePoints: selectedCustomer?.points || 0,
      maxUsablePoints
    };
  }, [orderItems, deliveryFee, usedPoints, selectedCustomer, selectedDiscountRate, customDiscountRate, discountSettings]);
  const handleUseAllPoints = () => {
    if (!selectedCustomer) return;
    const maxPoints = Math.min(selectedCustomer.points || 0, orderSummary.subtotal);
    setUsedPoints(maxPoints);
  };
  const handleAddressSearch = () => {
    if (window.daum && window.daum.Postcode) {
      new window.daum.Postcode({
        oncomplete: function(data: any) {
          let fullAddress = data.address;
          let extraAddress = '';
          if (data.addressType === 'R') {
            if (data.bname !== '') {
              extraAddress += data.bname;
            }
            if (data.buildingName !== '') {
              extraAddress += (extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName);
            }
            fullAddress += (extraAddress !== '' ? ` (${extraAddress})` : '');
          }
          setDeliveryAddress(fullAddress);
          setDeliveryAddressDetail('');
          
          // 배송비 자동 계산이 활성화되어 있으면 자동으로 계산
          if (deliveryFeeType === 'auto') {
            const { fee, district } = calculateDeliveryFee(fullAddress);
            setCalculatedDeliveryFee(fee);
            setSelectedDistrict(district);
            

          }
        }
      }).open();
    }
  }
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">완료</Badge>;
      case 'processing':
        return <Badge variant="secondary">처리중</Badge>;
      case 'canceled':
        return <Badge variant="destructive">취소</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  const pageTitle = existingOrder ? '주문 수정' : '주문테이블';
  const pageDescription = existingOrder ? '기존 주문을 수정합니다.' : '새로운 주문을 등록합니다.';
  const isLoading = ordersLoading || productsLoading;
  return (
    <div>
        <PageHeader
          title={pageTitle}
          description={pageDescription}
        />
        {/* 단독샵이므로 출고 지점 카드 제거 */}
        <fieldset disabled={isLoading} className="disabled:opacity-50">
          <div className="grid gap-8 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <Card>
                  <CardHeader>
                      <CardTitle>주문 정보</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                      {/* 주문 상품 */}
                      <div>
                          <span className="text-sm font-medium">주문 상품</span>
                          <Card className="mt-2">
                            <CardContent className="p-2">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>상품</TableHead>
                                        <TableHead className="w-[120px]">수량</TableHead>
                                        <TableHead className="w-[120px] text-right">단가</TableHead>
                                        <TableHead className="w-[120px] text-right">합계</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                                                         {orderItems.length > 0 ? (
                                     orderItems.map(item => (
                                         <TableRow key={item.docId}>
                                         <TableCell>
                                             <div className="flex items-center gap-2">
                                                 {item.name}
                                                 {item.isCustomProduct && (
                                                     <Badge variant="secondary" className="text-xs">
                                                         수동 추가
                                                     </Badge>
                                                 )}
                                             </div>
                                         </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateItemQuantity(item.docId, item.quantity - 1)} disabled={item.quantity <= 1}><MinusCircle className="h-4 w-4"/></Button>
                                                <Input id={`quantity-${item.docId}`} type="number" value={item.quantity} onChange={e => updateItemQuantity(item.docId, parseInt(e.target.value) || 1)} className="h-8 w-12 text-center" />
                                                                                                 <Button 
                                                   variant="outline" 
                                                   size="icon" 
                                                   className="h-6 w-6" 
                                                   onClick={() => updateItemQuantity(item.docId, item.quantity + 1)} 
                                                   disabled={!item.isCustomProduct && item.quantity >= item.stock}
                                                 >
                                                   <PlusCircle className="h-4 w-4"/>
                                                 </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">₩{item.price.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">₩{(item.price * item.quantity).toLocaleString()}</TableCell>
                                        <TableCell><Button variant="ghost" size="icon" onClick={() => removeItem(item.docId)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell>
                                        </TableRow>
                                    ))
                                    ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                        상품을 추가해주세요.
                                        </TableCell>
                                    </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            <div className="mt-2 p-2 border-t space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <Select 
                                        value={selectedMainCategory || ""}
                                        onValueChange={(value) => {
                                            setSelectedMainCategory(value);
                                            setSelectedMidCategory(null);
                                        }}>
                                        <SelectTrigger id="main-category-select">
                                            <SelectValue placeholder="대분류 선택" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {mainCategories.map(cat => (
                                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select
                                        value={selectedMidCategory || ""}
                                        onValueChange={(value) => {
                                            setSelectedMidCategory(value);
                                        }}
                                        disabled={!selectedMainCategory}
                                    >
                                        <SelectTrigger id="mid-category-select">
                                            <SelectValue placeholder="중분류 선택" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {midCategories.map(cat => (
                                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center gap-2">
                                {productsLoading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        <Select onValueChange={handleAddProduct} value="">
                                            <SelectTrigger id="product-select" className="flex-1">
                                                <SelectValue placeholder="상품을 선택하여 바로 추가하세요..." />
                                            </SelectTrigger>
                                                                                         <SelectContent>
                                                 {filteredProducts.map(p => (
                                                     <SelectItem key={p.docId} value={p.docId} disabled={p.stock === 0}>
                                                         {p.name} - ₩{p.price.toLocaleString()} (재고: {p.stock})
                                                     </SelectItem>
                                                 ))}
                                             </SelectContent>
                                        </Select>
                                        <Dialog open={isCustomProductDialogOpen} onOpenChange={setIsCustomProductDialogOpen}>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" size="icon">
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>수동 상품 추가</DialogTitle>
                                                    <DialogDescription>
                                                        등록되지 않은 상품을 임의 가격으로 주문에 추가합니다.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                                                                 <div className="space-y-4">
                                                     <div className="space-y-2">
                                                         <Label htmlFor="custom-product-name">상품명</Label>
                                                         <Input
                                                             id="custom-product-name"
                                                             placeholder="상품명을 입력하세요"
                                                             value={customProductName}
                                                             onChange={(e) => setCustomProductName(e.target.value)}
                                                         />
                                                     </div>
                                                     <div className="space-y-2">
                                                         <Label htmlFor="custom-product-price">가격</Label>
                                                         <Input
                                                             id="custom-product-price"
                                                             type="number"
                                                             placeholder="가격을 입력하세요"
                                                             value={customProductPrice}
                                                             onChange={(e) => setCustomProductPrice(e.target.value)}
                                                         />
                                                     </div>
                                                     <div className="space-y-2">
                                                         <Label htmlFor="custom-product-quantity">수량</Label>
                                                         <Input
                                                             id="custom-product-quantity"
                                                             type="number"
                                                             min="1"
                                                             placeholder="수량을 입력하세요"
                                                             value={customProductQuantity}
                                                             onChange={(e) => setCustomProductQuantity(Number(e.target.value))}
                                                         />
                                                     </div>
                                                 </div>
                                                <DialogFooter>
                                                    <Button variant="outline" onClick={() => setIsCustomProductDialogOpen(false)}>
                                                        취소
                                                    </Button>
                                                    <Button onClick={handleAddCustomProduct}>
                                                        추가
                                                    </Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>
                                    </>
                                )}
                                </div>
                            </div>
                            </CardContent>
                          </Card>
                      </div>
                       {/* 결제 정보 */}
                      <div>
                          <span className="text-sm font-medium">결제 정보</span>
                          <Card className="mt-2">
                            <CardContent className="p-4 space-y-4">
                                <div>
                                    <Label className="text-xs text-muted-foreground">결제 수단</Label>
                                    <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="flex items-center flex-wrap gap-4 mt-2">
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="card" id="pay-card" /><Label htmlFor="pay-card">카드</Label></div>
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="cash" id="pay-cash" /><Label htmlFor="pay-cash">현금</Label></div>
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="transfer" id="pay-transfer" /><Label htmlFor="pay-transfer">계좌이체</Label></div>
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="mainpay" id="pay-mainpay" /><Label htmlFor="pay-mainpay">메인페이</Label></div>
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="shopping_mall" id="pay-mall" /><Label htmlFor="pay-mall">쇼핑몰</Label></div>
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="epay" id="pay-epay" /><Label htmlFor="pay-epay">이페이</Label></div>
                                    </RadioGroup>
                                </div>
                                 <div>
                                    <Label className="text-xs text-muted-foreground">결제 상태</Label>
                                    <RadioGroup value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as PaymentStatus)} className="flex items-center gap-4 mt-2">
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="pending" id="status-pending" /><Label htmlFor="status-pending">결제대기</Label></div>
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="paid" id="status-paid" /><Label htmlFor="status-paid">결제완료</Label></div>
                                    </RadioGroup>
                                </div>
                            </CardContent>
                          </Card>
                      </div>
                      {/* 주문자 정보 */}
                      <div>
                          <span className="text-sm font-medium">주문자 정보</span>
                          <Card className="mt-2">
                              <CardContent className="p-4">
                                {/* 고객 검색 섹션 */}
                                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                                  <div className="flex items-center justify-between mb-4">
                                    <h4 className="font-medium text-gray-900">고객 검색</h4>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => {
                                        setSelectedCustomer(null);
                                        setUsedPoints(0);
                                      }}
                                      disabled={!selectedCustomer}
                                    >
                                      고객 선택 해제
                                    </Button>
                                  </div>
                                  {!selectedCustomer ? (
                                    <div className="space-y-4 customer-search-container">
                                      <div className="space-y-2">
                                        <Label htmlFor="customer-search-unified" className="text-xs">고객 검색</Label>
                                        <div className="relative">
                                          <Input 
                                            id="customer-search-unified"
                                            name="customer-search-unified"
                                            placeholder="회사명, 주문자명, 연락처 뒷4자리로 검색"
                                            value={customerSearchQuery}
                                            onChange={(e) => {
                                              const value = e.target.value;
                                              setCustomerSearchQuery(value);
                                              setIsCustomerSearchOpen(true);
                                              debouncedCustomerSearch(value);
                                            }}
                                            onFocus={() => setIsCustomerSearchOpen(true)}
                                          />
                                          {customerSearchLoading && (
                                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            </div>
                                          )}
                                          {/* 검색 결과 드롭다운 */}
                                          {isCustomerSearchOpen && customerSearchResults.length > 0 && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                              {customerSearchResults.map(customer => (
                                                <div 
                                                  key={customer.id}
                                                  className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                                                  onClick={() => {
                                                    handleCustomerSelect(customer);
                                                    setIsCustomerSearchOpen(false);
                                                    setCustomerSearchQuery("");
                                                  }}
                                                >
                                                  <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                      <p className="font-medium">{customer.name}</p>
                                                      {customer.companyName && (
                                                        <p className="text-sm text-gray-600">{customer.companyName}</p>
                                                      )}
                                                      <p className="text-sm text-gray-500">{customer.contact}</p>
                                                      {customer.email && (
                                                        <p className="text-sm text-gray-500">{customer.email}</p>
                                                      )}
                                                    </div>
                                                    <div className="text-right">
                                                      <p className="text-sm font-medium text-blue-600">
                                                        {(customer.points || 0).toLocaleString()} P
                                                      </p>
                                                    </div>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                          {/* 검색 결과가 없을 때 */}
                                          {isCustomerSearchOpen && customerSearchQuery.trim() && customerSearchResults.length === 0 && !customerSearchLoading && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                                              <p className="text-sm text-gray-500">검색 결과가 없습니다.</p>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                                      <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                          <p className="font-medium text-blue-900">{selectedCustomer.name}</p>
                                          {selectedCustomer.companyName && (
                                            <p className="text-sm text-blue-700">{selectedCustomer.companyName}</p>
                                          )}
                                          {selectedCustomer.email && (
                                            <p className="text-sm text-blue-600">{selectedCustomer.email}</p>
                                          )}
                                          <p className="text-sm text-blue-600 font-medium mt-1">
                                            보유 포인트: {(selectedCustomer.points || 0).toLocaleString()} P
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="orderer-company">회사명</Label>
                                        <Input 
                                            id="orderer-company" 
                                            name="orderer-company"
                                            placeholder="회사명 입력" 
                                            value={ordererCompany} 
                                            onChange={e => setOrdererCompany(e.target.value)} 
                                            disabled={!!selectedCustomer}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="orderer-name">주문자명</Label>
                                        <Input 
                                            id="orderer-name" 
                                            name="orderer-name"
                                            placeholder="주문자명 입력" 
                                            value={ordererName} 
                                            onChange={e => setOrdererName(e.target.value)}
                                            disabled={!!selectedCustomer}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="orderer-contact">주문자 연락처</Label>
                                        <Input 
                                            id="orderer-contact" 
                                            name="orderer-contact"
                                            placeholder="010-1234-5678" 
                                            value={ordererContact} 
                                            onChange={(e) => handleGenericContactChange(e, setOrdererContact)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="orderer-email">이메일</Label>
                                        <Input 
                                            id="orderer-email" 
                                            name="orderer-email"
                                            type="email" 
                                            placeholder="email@example.com" 
                                            value={ordererEmail} 
                                            onChange={e => setOrdererEmail(e.target.value)}
                                            disabled={!!selectedCustomer}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 mt-4">
                                  <Checkbox id="anonymous" checked={isAnonymous} onCheckedChange={(checked) => setIsAnonymous(!!checked)} />
                                  <label
                                    htmlFor="anonymous"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                  >
                                    익명으로 보내기 (인수증에 주문자 정보 미표시)
                                  </label>
                                </div>
                                <div className="flex items-center space-x-2 mt-4">
                                  <Checkbox id="register-customer" checked={registerCustomer} onCheckedChange={(checked) => setRegisterCustomer(!!checked)} />
                                  <label
                                    htmlFor="register-customer"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                  >
                                    이 주문자 정보를 고객으로 등록/업데이트합니다.(마케팅동의 및 포인트적립 사용 동의)                                  </label>
                                </div>
                              </CardContent>
                          </Card>
                      </div>
                      {/* 수령 정보 */}
                      <div>
                          <span className="text-sm font-medium">수령 정보</span>
                          <RadioGroup value={receiptType} onValueChange={(v) => setReceiptType(v as ReceiptType)} className="flex flex-row gap-4 mt-2">
                              <div className="flex items-center space-x-2"><RadioGroupItem value="store_pickup" id="receipt-store-pickup" /><Label htmlFor="receipt-store-pickup">매장픽업 (즉시)</Label></div>
                              <div className="flex items-center space-x-2"><RadioGroupItem value="pickup_reservation" id="receipt-pickup-reservation" /><Label htmlFor="receipt-pickup-reservation">픽업예약</Label></div>
                              <div className="flex items-center space-x-2"><RadioGroupItem value="delivery_reservation" id="receipt-delivery-reservation" /><Label htmlFor="receipt-delivery-reservation">배송예약</Label></div>
                          </RadioGroup>
                          {(receiptType === 'pickup_reservation') && (
                              <Card className="mt-2">
                                  <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                          <Label htmlFor="pickup-date-time">픽업일시</Label>
                                          <div className="flex gap-2">
                                              <Popover>
                                                  <PopoverTrigger asChild>
                                                  <Button
                                                      id="pickup-date-time"
                                                      variant={"outline"}
                                                      className={cn("w-full justify-start text-left font-normal", !scheduleDate && "text-muted-foreground")}
                                                  >
                                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                                      {scheduleDate ? format(scheduleDate, "PPP", { locale: ko }) : <span>날짜 선택</span>}
                                                  </Button>
                                                  </PopoverTrigger>
                                                  <PopoverContent className="w-auto p-0">
                                                  <Calendar locale={ko} mode="single" selected={scheduleDate} onSelect={setScheduleDate} initialFocus />
                                                  </PopoverContent>
                                              </Popover>
                                              <Select value={scheduleTime} onValueChange={setScheduleTime}>
                                                  <SelectTrigger id="pickup-time" className="w-[120px]">
                                                      <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                      {timeOptions.map(time => <SelectItem key={time} value={time}>{time}</SelectItem>)}
                                                  </SelectContent>
                                              </Select>
                                          </div>
                                      </div>
                                      <div/>
                                      <div className="space-y-2">
                                          <Label htmlFor="picker-name">픽업자 이름</Label>
                                          <Input id="picker-name" name="picker-name" value={pickerName} onChange={e => setPickerName(e.target.value)} />
                                      </div>
                                      <div className="space-y-2">
                                          <Label htmlFor="picker-contact">픽업자 연락처</Label>
                                          <Input id="picker-contact" name="picker-contact" value={pickerContact} onChange={(e) => handleGenericContactChange(e, setPickerContact)} />
                                      </div>
                                  </CardContent>
                              </Card>
                          )}
                          {(receiptType === 'store_pickup') && (
                              <Card className="mt-2">
                                  <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                          <Label htmlFor="picker-name">픽업자 이름</Label>
                                          <Input id="picker-name" name="picker-name" value={pickerName} onChange={e => setPickerName(e.target.value)} />
                                      </div>
                                      <div className="space-y-2">
                                          <Label htmlFor="picker-contact">픽업자 연락처</Label>
                                          <Input id="picker-contact" name="picker-contact" value={pickerContact} onChange={(e) => handleGenericContactChange(e, setPickerContact)} />
                                      </div>
                                  </CardContent>
                              </Card>
                          )}
                          {(receiptType === 'delivery_reservation') && (
                              <Card className="mt-2">
                                  <CardContent className="p-4 space-y-4">
                                      <div className="space-y-2">
                                          <Label htmlFor="delivery-date-time">배송일시</Label>
                                          <div className="flex gap-2">
                                              <Popover>
                                                  <PopoverTrigger asChild>
                                                  <Button
                                                      id="delivery-date-time"
                                                      variant={"outline"}
                                                      className={cn("w-full justify-start text-left font-normal", !scheduleDate && "text-muted-foreground")}
                                                  >
                                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                                      {scheduleDate ? format(scheduleDate, "PPP", { locale: ko }) : <span>날짜 선택</span>}
                                                  </Button>
                                                  </PopoverTrigger>
                                                  <PopoverContent className="w-auto p-0">
                                                  <Calendar locale={ko} mode="single" selected={scheduleDate} onSelect={setScheduleDate} initialFocus />
                                                  </PopoverContent>
                                              </Popover>
                                              <Select value={scheduleTime} onValueChange={setScheduleTime}>
                                                  <SelectTrigger id="delivery-time" className="w-[120px]">
                                                      <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                      {timeOptions.map(time => <SelectItem key={time} value={time}>{time}</SelectItem>)}
                                                  </SelectContent>
                                              </Select>
                                          </div>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <div className="space-y-2">
                                              <Label htmlFor="recipient-name">받는 분 이름</Label>
                                              <Input id="recipient-name" name="recipient-name" placeholder="이름 입력" value={recipientName} onChange={e => setRecipientName(e.target.value)} />
                                          </div>
                                          <div className="space-y-2">
                                              <Label htmlFor="recipient-contact">받는 분 연락처</Label>
                                              <Input id="recipient-contact" name="recipient-contact" placeholder="010-1234-5678" value={recipientContact} onChange={(e) => handleGenericContactChange(e, setRecipientContact)} />
                                          </div>
                                      </div>
                                      <div className="space-y-2">
                                          <Label htmlFor="delivery-address">배송지</Label>
                                          <div className="flex gap-2">
                                          <Input id="delivery-address" name="delivery-address" placeholder="주소 검색 버튼을 클릭하세요" value={deliveryAddress} readOnly />
                                          <Button type="button" variant="outline" onClick={handleAddressSearch}>
                                              <Search className="mr-2 h-4 w-4" /> 주소 검색
                                          </Button>
                                          </div>
                                          <Input id="delivery-address-detail" name="delivery-address-detail" placeholder="상세 주소 입력" value={deliveryAddressDetail} onChange={(e) => setDeliveryAddressDetail(e.target.value)} />
                                      </div>
                                      <div className="space-y-2">
                                          <Label htmlFor="delivery-fee-type">배송비</Label>
                                          <RadioGroup value={deliveryFeeType} onValueChange={(v) => setDeliveryFeeType(v as "auto" | "manual")} className="flex items-center gap-4 mt-2">
                                              <div className="flex items-center space-x-2">
                                                  <RadioGroupItem value="auto" id="delivery-fee-auto" />
                                                  <Label htmlFor="delivery-fee-auto">자동 계산</Label>
                                              </div>
                                              <div className="flex items-center space-x-2">
                                                  <RadioGroupItem value="manual" id="delivery-fee-manual" />
                                                  <Label htmlFor="delivery-fee-manual">직접 입력</Label>
                                              </div>
                                          </RadioGroup>
                                          
                                          {deliveryFeeType === 'auto' && (
                                              <div className="space-y-2">
                                                  {selectedDistrict ? (
                                                      <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                                                          <div className="flex items-center justify-between">
                                                              <span className="text-sm font-medium text-green-800">
                                                                  선택된 지역: {selectedDistrict} - ₩{calculatedDeliveryFee.toLocaleString()}
                                                              </span>
                                                              <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                                                  <span className="text-white text-xs">✓</span>
                                                              </div>
                                                          </div>
                                                      </div>
                                                  ) : deliveryAddress ? (
                                                      <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                                          <span className="text-sm text-yellow-800">
                                                              해당 지역의 배송비 정보가 없습니다.
                                                          </span>
                                                      </div>
                                                  ) : (
                                                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                                          <span className="text-sm text-gray-600">
                                                              배송지 주소를 입력하면 자동으로 배송비가 계산됩니다.
                                                          </span>
                                                      </div>
                                                  )}
                                              </div>
                                          )}
                                          
                                          {deliveryFeeType === 'manual' && (
                                              <div className="flex items-center gap-2 mt-2">
                                                  <span className="text-sm">₩</span>
                                                  <Input
                                                      id="manual-delivery-fee"
                                                      type="number"
                                                      name="manual-delivery-fee"
                                                      placeholder="배송비 입력"
                                                      value={manualDeliveryFee}
                                                      onChange={(e) => setManualDeliveryFee(Number(e.target.value))}
                                                      className="w-32"
                                                  />
                                              </div>
                                          )}
                                          
                                      </div>
                                  </CardContent>
                              </Card>
                          )}
                      </div>
                      {/* 메시지 */}
                      <div className="space-y-3">
                          <span className="text-sm font-medium">메시지</span>
                          <RadioGroup value={messageType} onValueChange={(v) => setMessageType(v as MessageType)} className="flex items-center gap-4 mt-2">
                              <div className="flex items-center space-x-2"><RadioGroupItem value="card" id="msg-card" /><Label htmlFor="msg-card">카드 메시지</Label></div>
                              <div className="flex items-center space-x-2"><RadioGroupItem value="ribbon" id="msg-ribbon" /><Label htmlFor="msg-ribbon">리본 메시지</Label></div>
                          </RadioGroup>
                          <div>
                              <Label htmlFor="message-content">메시지 내용</Label>
                              <Textarea 
                                  id="message-content" 
                                  name="message-content"
                                  placeholder={messageType === 'card' ? "카드 메시지 내용을 입력하세요." : "리본 문구(좌/우)를 입력하세요."} 
                                  className="mt-2" 
                                  value={messageContent} 
                                  onChange={e => setMessageContent(e.target.value)} 
                              />
                          </div>
                          <div>
                              <Label htmlFor="message-sender">보내는 사람</Label>
                              <Input 
                                  id="message-sender" 
                                  name="message-sender"
                                  placeholder="보내는 사람 이름을 입력하세요 (예: - 홍길동 -)" 
                                  className="mt-2" 
                                  value={messageSender} 
                                  onChange={e => setMessageSender(e.target.value)} 
                              />
                          </div>
                      </div>
                      {/* 요청사항 */}
                        <div className="space-y-2">
                            <Label htmlFor="special-request">요청 사항</Label>
                            <Textarea id="special-request" name="special-request" placeholder="특별 요청사항을 입력하세요." value={specialRequest} onChange={e => setSpecialRequest(e.target.value)} />
                        </div>
                  </CardContent>
              </Card>
            </div>
            <div className="md:col-span-1">
                <Card>
                    <CardHeader>
                        <CardTitle>주문 요약</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* 기존 주문 요약 내용 */}
                        <div className="flex justify-between">
                            <span>상품 합계</span>
                            <span>₩{orderSummary.subtotal.toLocaleString()}</span>
                        </div>
                        {/* 할인율 선택 - 단독샵 */}
                        <div className="space-y-2">
                          <Label>할인율 선택</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              placeholder="수동 할인율"
                              value={customDiscountRate}
                              onChange={(e) => {
                                const value = Number(e.target.value);
                                setCustomDiscountRate(Math.min(Math.max(0, value), 50));
                                if (value > 0) setSelectedDiscountRate(0);
                              }}
                              min="0"
                              max="50"
                              className="w-20"
                            />
                            <span className="text-sm text-muted-foreground">% (최대 50%)</span>
                          </div>
                          {(selectedDiscountRate > 0 || customDiscountRate > 0) && (
                            <div className="flex justify-between text-green-600">
                              <span>할인 금액</span>
                              <span>-₩{orderSummary.discountAmount.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-between">
                            <span>배송비</span>
                            <span className={deliveryFee === 0 ? "text-green-600 font-medium" : ""}>
                              {deliveryFee === 0 ? "무료" : `₩${deliveryFee.toLocaleString()}`}
                            </span>
                        </div>

                        <Separator />
                        <div className="space-y-2">
                            <Label htmlFor="used-points">포인트 사용</Label>
                            <div className="flex items-center gap-2">
                                <Input 
                                    id="used-points"
                                    type="number" 
                                    name="used-points"
                                    value={usedPoints}
                                    onChange={(e) => {
                                      const value = Number(e.target.value);
                                      const maxPoints = orderSummary.maxUsablePoints;
                                      setUsedPoints(Math.min(Math.max(0, value), maxPoints));
                                    }}
                                    max={orderSummary.maxUsablePoints}
                                    disabled={!selectedCustomer || orderSummary.availablePoints === 0 || orderSummary.discountedSubtotal < 5000}
                                    placeholder={selectedCustomer ? 
                                      (orderSummary.discountedSubtotal >= 5000 ? "사용할 포인트 입력" : "5천원 이상 주문 시 사용 가능") : 
                                      "고객을 먼저 선택하세요"
                                    }
                                />
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={handleUseAllPoints} 
                                  disabled={!selectedCustomer || orderSummary.availablePoints === 0 || orderSummary.discountedSubtotal < 5000}
                                >
                                  전액 사용
                                </Button>
                            </div>
                            {selectedCustomer ? (
                              <div className="text-xs space-y-1">
                                <p className="text-muted-foreground">
                                  보유 포인트: <span className="font-medium text-blue-600">{orderSummary.availablePoints.toLocaleString()} P</span>
                                </p>
                                {orderSummary.discountedSubtotal >= 5000 ? (
                                  <p className="text-muted-foreground">
                                    사용 가능: <span className="font-medium text-green-600">{orderSummary.maxUsablePoints.toLocaleString()} P</span>
                                  </p>
                                ) : (
                                  <p className="text-muted-foreground text-amber-600">
                                    ⚠️ 5천원 이상 주문 시 포인트 사용 가능
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                고객을 선택하면 포인트를 사용할 수 있습니다.
                              </p>
                            )}
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                            <span>포인트 할인</span>
                            <span className="text-destructive">-₩{orderSummary.pointsUsed.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-sm">
                            <span>적립 예정 포인트</span>
                            <span>{orderSummary.pointsEarned.toLocaleString()} P</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold text-lg">
                            <span>총 결제 금액</span>
                            <span>₩{orderSummary.total.toLocaleString()}</span>
                        </div>
                        {/* 주문등록 버튼을 총결제금액 아래에 추가 */}
                        <div className="pt-4">
                            <Button onClick={handleCompleteOrder} disabled={isSubmitting} className="w-full">
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  {existingOrder ? "수정 중..." : "등록 중..."}
                                </>
                              ) : (
                                existingOrder ? "주문 수정" : "주문 등록"
                              )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
          </div>
          <div className="mt-8">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>오늘 주문 현황</CardTitle>
                        <CardDescription>오늘 접수된 주문 목록입니다.</CardDescription>
                    </div>
                    <Button variant="outline" onClick={() => setShowTodaysOrders(prev => !prev)}>
                        {showTodaysOrders ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                        {showTodaysOrders ? "숨기기" : "오늘 주문 현황 보기"}
                    </Button>
                </CardHeader>
                {showTodaysOrders && (
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>주문ID</TableHead>
                                    <TableHead>주문자</TableHead>
                                    <TableHead>받는분</TableHead>
                                    <TableHead>상태</TableHead>
                                    <TableHead className="text-right">총액</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {todaysOrders.length > 0 ? todaysOrders.map(order => (
                                    <TableRow key={order.id}>
                                        <TableCell className="font-mono text-xs">{order.id.slice(0, 8)}...</TableCell>
                                        <TableCell>{order.orderer.name}</TableCell>
                                        <TableCell>{order.deliveryInfo?.recipientName || order.pickupInfo?.pickerName || '-'}</TableCell>
                                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                                        <TableCell className="text-right">₩{order.summary.total.toLocaleString()}</TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                            오늘 접수된 주문이 없습니다.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                )}
            </Card>
        </div>
        </fieldset>
    </div>
  );
}
