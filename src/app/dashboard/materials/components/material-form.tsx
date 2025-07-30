
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useBranches } from "@/hooks/use-branches"
import { useEffect } from "react"

const materialSchema = z.object({
  name: z.string().min(1, "자재명을 입력해주세요."),
  mainCategory: z.string().min(1, "대분류를 선택해주세요."),
  midCategory: z.string().min(1, "중분류를 선택해주세요."),
  price: z.coerce.number().min(0, "가격은 0 이상이어야 합니다."),
  supplier: z.string().min(1, "공급업체를 선택해주세요."),
  size: z.string().min(1, "규격을 입력해주세요."),
  color: z.string().min(1, "색상을 입력해주세요."),
  branch: z.string().min(1, "지점을 선택해주세요."),
  stock: z.coerce.number().min(0, "재고는 0 이상이어야 합니다.").default(0),
})

export type MaterialFormValues = z.infer<typeof materialSchema>

interface MaterialFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: MaterialFormValues) => Promise<void>;
  material?: any;
  initialData?: any;
  branches?: any[];
  selectedBranch?: string;
}

const defaultValues: MaterialFormValues = {
  name: "",
  mainCategory: "",
  midCategory: "",
  price: 0,
  supplier: "",
  size: "",
  color: "",
  branch: "",
  stock: 0,
}

export function MaterialForm({ isOpen, onOpenChange, onSubmit, material, initialData, branches: propBranches, selectedBranch }: MaterialFormProps) {
  const { branches } = useBranches();
  const availableBranches = propBranches || branches;

  const form = useForm<MaterialFormValues>({
    resolver: zodResolver(materialSchema),
    defaultValues,
  })

  useEffect(() => {
    if(isOpen) {
      form.reset(material || defaultValues);
    }
  }, [isOpen, material, form]);
  
  const handleFormSubmit = (data: MaterialFormValues) => {
    onSubmit(data);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{material ? "자재 정보 수정" : "새 자재 추가"}</DialogTitle>
          <DialogDescription>자재의 상세 정보를 입력해주세요.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
             <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>자재명</FormLabel>
                  <FormControl>
                    <Input placeholder="마르시아 장미" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="mainCategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>대분류</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="대분류 선택" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="생화">생화</SelectItem>
                        <SelectItem value="조화">조화</SelectItem>
                        <SelectItem value="화분">화분</SelectItem>
                        <SelectItem value="기타자재">기타자재</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="midCategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>중분류</FormLabel>
                     <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="중분류 선택" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="장미">장미</SelectItem>
                        <SelectItem value="카네이션">카네이션</SelectItem>
                        <SelectItem value="관엽식물">관엽식물</SelectItem>
                        <SelectItem value="난">난</SelectItem>
                         <SelectItem value="기타">기타</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
             <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>가격</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="5000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="size"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>규격</FormLabel>
                        <FormControl>
                        <Input placeholder="1단" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>색상</FormLabel>
                        <FormControl>
                        <Input placeholder="Pink" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            <FormField
              control={form.control}
              name="supplier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>공급업체</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="공급업체 선택" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="경부선꽃시장">경부선꽃시장</SelectItem>
                      <SelectItem value="플라워팜">플라워팜</SelectItem>
                      <SelectItem value="자재월드">자재월드</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="branch"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>소속 지점</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="소속 지점 선택" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {branches.filter(b => b.type !== '본사').map(branch => (
                        <SelectItem key={branch.id} value={branch.name}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
             {material && (
              <FormField
                control={form.control}
                name="stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>재고</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} disabled />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <DialogFooter className="pt-4">
                <DialogClose asChild>
                    <Button type="button" variant="secondary">취소</Button>
                </DialogClose>
                <Button type="submit">저장</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
