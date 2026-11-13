Gid Post Results File 1.0 
### 
# MAT-fem Rev Shell v1.1 
# 
GaussPoints "GPTR" ElemType Linear  
Number Of Gauss Points: 1  
Natural Coordinates: Internal  
End gausspoints 
Result "Displacement" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Displ", "Y-Displ", "Z-Displ" 
Values 
     1         00000 -1.44400e-003 0  
     2 -1.54120e-004 -7.23937e-004 0  
     3         00000         00000 0  
End Values 
# 
Result "Local Rotation" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Rot", "Y-Rot", "Z-Rot" 
Values 
     1 0.0 0.0         00000 
     2 0.0 0.0  5.10699e-005 
     3 0.0 0.0         00000 
End Values 
# 
Result "Reaction Force" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Force", "Y-Force", "Z-Force" 
Values 
     1  1.71149e+003         00000         00000  
     2         00000         00000         00000  
     3 -9.35815e+003  8.37177e+003         00000  
End Values 
# 
Result "Reaction Moment" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Moment", "Y-Moment", "Z-Moment" 
Values 
     1         00000         00000  9.98870e+002  
     2         00000         00000         00000  
     3         00000         00000 -6.75739e+003  
End Values 
# 
Result "Moment" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Mx", "Mf", "Mxf" 
Values 
     1 -1.00714e+001  -1.00714e+001  0.0 
     2 -9.43914e-001  -5.66348e+000  0.0 
     3 8.18359e+000  -1.25555e+000  0.0 
End Values 
Result "Shear" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Qx", "Qy", "Qz" 
Values 
     1 0.0  0.0  -8.58097e-001 
     2 0.0  0.0  2.84710e-001 
     3 0.0  0.0  1.42752e+000 
End Values 
Result "Membrane" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Nx", "Nf", "Nxf" 
Values 
     1 -6.48768e+001  -4.49813e+001  0.0 
     2 -5.39513e+001  -3.19522e+001  0.0 
     3 -4.30257e+001  -1.89231e+001  0.0 
End Values 
