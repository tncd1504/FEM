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
     1         00000         00000 0  
     2 -9.27511e-005 -3.24421e-004 0  
     3 -1.64839e-004 -7.53272e-004 0  
     4 -9.82678e-005 -8.94782e-004 0  
     5         00000 -9.13739e-004 0  
End Values 
# 
Result "Local Rotation" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Rot", "Y-Rot", "Z-Rot" 
Values 
     1 0.0 0.0         00000 
     2 0.0 0.0  4.44121e-005 
     3 0.0 0.0  1.75781e-005 
     4 0.0 0.0  1.10749e-006 
     5 0.0 0.0         00000 
End Values 
# 
Result "Reaction Force" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Force", "Y-Force", "Z-Force" 
Values 
     1 -8.75786e+003  8.37177e+003         00000  
     2         00000         00000         00000  
     3         00000         00000         00000  
     4         00000         00000         00000  
     5  1.40983e+001         00000         00000  
End Values 
# 
Result "Reaction Moment" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Moment", "Y-Moment", "Z-Moment" 
Values 
     1         00000         00000 -1.08464e+004  
     2         00000         00000         00000  
     3         00000         00000         00000  
     4         00000         00000         00000  
     5         00000         00000 -1.75206e+002  
End Values 
# 
Result "Moment" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Mx", "Mf", "Mxf" 
Values 
     1 1.46483e+001  5.60343e-001  0.0 
     2 2.46962e+000  -2.46456e+000  0.0 
     3 -7.80275e+000  -4.24076e+000  0.0 
     4 -3.16601e+000  -1.71380e+000  0.0 
     5 -4.35541e-001  -4.35541e-001  0.0 
End Values 
Result "Shear" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Qx", "Qy", "Qz" 
Values 
     1 0.0  0.0  3.35613e+000 
     2 0.0  0.0  1.61835e+000 
     3 0.0  0.0  -4.95985e-001 
     4 0.0  0.0  -1.39617e-001 
     5 0.0  0.0  5.93313e-001 
End Values 
Result "Membrane" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Nx", "Nf", "Nxf" 
Values 
     1 -3.94494e+001  -1.26617e+001  0.0 
     2 -4.25794e+001  -2.16964e+001  0.0 
     3 -4.79653e+001  -3.89182e+001  0.0 
     4 -5.11457e+001  -4.94244e+001  0.0 
     5 -5.20701e+001  -5.17433e+001  0.0 
End Values 
