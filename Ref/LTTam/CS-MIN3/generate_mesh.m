
function nodes=generate_mesh(nx,ny)
%----------------------------
% ma tran ket noi nut phan tu
%----------------------------
nodes = [];
for i=1:ny
    for j=1:nx
        nodes =[nodes;(nx+1)*(i-1)+j (nx+1)*i+j (nx+1)*i+j+1;
               (nx+1)*(i-1)+j  (nx+1)*i+j+1  (nx+1)*(i-1)+j+1];
    end
end